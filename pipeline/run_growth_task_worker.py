#!/usr/bin/env python3
"""
Execute growth workflow tasks and write auditable action log rows.

Workflow:
signal_trial_conversion_risk_daily -> growth_task_queue -> action_log
"""

from __future__ import annotations

import argparse
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import duckdb


def load_dotenv_if_present() -> None:
    """Load a .env file from project root or pipeline dir into process env."""
    search_paths = [
        Path(__file__).resolve().parent.parent / ".env",
        Path(__file__).resolve().parent / ".env",
    ]
    for env_path in search_paths:
        if not env_path.exists():
            continue
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        break


def resolve_path(path_value: str, project_root: Path) -> str:
    if path_value.startswith("md:") or os.path.isabs(path_value):
        return path_value
    return str((project_root / path_value.lstrip("./")).resolve())


def connect() -> duckdb.DuckDBPyConnection:
    load_dotenv_if_present()
    project_root = Path(__file__).resolve().parent.parent

    warehouse_path_raw = os.environ.get(
        "WAREHOUSE_DUCKDB_PATH",
        os.environ.get("MOTHERDUCK_PATH", "/tmp/browserbase_warehouse.duckdb"),
    )
    motherduck_token = os.environ.get("MOTHERDUCK_TOKEN", "")

    warehouse_path = resolve_path(warehouse_path_raw, project_root)

    connect_kwargs: dict = {}
    if warehouse_path.startswith("md:") and motherduck_token:
        connect_kwargs["config"] = {"motherduck_token": motherduck_token}

    conn = duckdb.connect(warehouse_path, **connect_kwargs)
    return conn


def ensure_action_log_table(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute("CREATE SCHEMA IF NOT EXISTS gtm")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS gtm.action_log (
            action_id TEXT PRIMARY KEY,
            signal_id TEXT,
            task_id TEXT,
            organization_id TEXT,
            action_type TEXT,
            destination_system TEXT,
            actor_type TEXT,
            actor_id TEXT,
            executed_at TIMESTAMP,
            status TEXT,
            error_message TEXT,
            outcome_label TEXT,
            _loaded_at TIMESTAMP
        )
        """
    )
    # Auto-migrate older action_log tables that predate the workflow worker schema.
    columns_to_add = {
        "task_id": "TEXT",
        "organization_id": "TEXT",
        "outcome_label": "TEXT",
        "destination_system": "TEXT",
        "actor_type": "TEXT",
        "actor_id": "TEXT",
        "_loaded_at": "TIMESTAMP",
    }
    for column_name, column_type in columns_to_add.items():
        conn.execute(
            f"""
            ALTER TABLE gtm.action_log
            ADD COLUMN IF NOT EXISTS {column_name} {column_type}
            """
        )


def choose_destination_system(priority: str) -> str:
    if priority in ("urgent", "high"):
        return "growth_priority_queue"
    return "growth_standard_queue"


def build_outcome_label(priority: str, reason_code: str) -> str:
    if priority == "urgent":
        return f"escalated_{reason_code}"
    return f"queued_{reason_code}"


def run_worker(limit: int, dry_run: bool) -> int:
    conn = connect()
    try:
        ensure_action_log_table(conn)

        queue_rows = conn.execute(
            """
            SELECT
                q.task_id,
                q.signal_id,
                q.organization_id,
                q.action_type,
                q.priority,
                q.reason_code,
                q.signal_score
            FROM gtm.growth_task_queue q
            LEFT JOIN gtm.action_log a
              ON a.task_id = q.task_id
             AND a.signal_id = q.signal_id
            WHERE a.task_id IS NULL
            ORDER BY q.created_at
            LIMIT ?
            """,
            [limit],
        ).fetchall()

        if not queue_rows:
            print("No pending growth tasks to process.")
            return 0

        now = datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)
        inserts = []
        for row in queue_rows:
            task_id, signal_id, organization_id, action_type, priority, reason_code, signal_score = row
            destination_system = choose_destination_system(priority)
            actor_type = "automation"
            actor_id = "growth_task_worker_v1"

            # Deterministic execution policy:
            # Extremely risky and no-usage signals are marked failed for explicit follow-up.
            is_failure = bool(priority == "urgent" and reason_code == "no_recent_usage" and float(signal_score) >= 0.95)
            status = "failed" if is_failure else "success"
            error_message = "manual_review_required_for_zero_usage_urgent_signal" if is_failure else None
            outcome_label = build_outcome_label(priority, reason_code)

            inserts.append(
                (
                    str(uuid.uuid4()),
                    signal_id,
                    task_id,
                    organization_id,
                    action_type,
                    destination_system,
                    actor_type,
                    actor_id,
                    now,
                    status,
                    error_message,
                    outcome_label,
                    now,
                )
            )

        if dry_run:
            print(f"Dry run: would insert {len(inserts)} action_log rows.")
            return len(inserts)

        conn.executemany(
            """
            INSERT INTO gtm.action_log (
                action_id,
                signal_id,
                task_id,
                organization_id,
                action_type,
                destination_system,
                actor_type,
                actor_id,
                executed_at,
                status,
                error_message,
                outcome_label,
                _loaded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            inserts,
        )

        print(f"Inserted {len(inserts)} action_log rows.")
        return len(inserts)
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Execute growth tasks into action log.")
    parser.add_argument("--limit", type=int, default=1000, help="Max tasks to process per run.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write rows.")
    args = parser.parse_args()
    run_worker(limit=args.limit, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
