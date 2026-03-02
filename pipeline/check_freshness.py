#!/usr/bin/env python3
"""Check table freshness across warehouse schemas and optionally send an alert."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import requests


@dataclass
class SchemaThreshold:
    name: str
    max_age_hours: float


DEFAULT_THRESHOLDS = [
    SchemaThreshold("bronze_supabase", 24.0),
    SchemaThreshold("silver", 24.0),
    SchemaThreshold("growth", 48.0),
    SchemaThreshold("product", 48.0),
    SchemaThreshold("finance", 48.0),
    SchemaThreshold("eng", 48.0),
    SchemaThreshold("ops", 48.0),
    SchemaThreshold("core", 48.0),
]


def load_dotenv_if_present() -> None:
    paths = [
        Path(__file__).resolve().parent.parent / ".env",
        Path(__file__).resolve().parent / ".env",
    ]
    for env_path in paths:
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


def parse_thresholds(raw: str | None) -> list[SchemaThreshold]:
    if not raw:
        return DEFAULT_THRESHOLDS
    payload = json.loads(raw)
    parsed: list[SchemaThreshold] = []
    for schema_name, max_age in payload.items():
        parsed.append(SchemaThreshold(schema_name, float(max_age)))
    return parsed


def freshness_column_expr() -> str:
    return """
        CASE
            WHEN column_name = '_loaded_at' THEN 1
            WHEN column_name = '_calculated_at' THEN 2
            WHEN column_name = 'triggered_at' THEN 3
            WHEN column_name = '_synced_at' THEN 4
            WHEN column_name = 'metric_date' THEN 5
            WHEN column_name = 'as_of_date' THEN 6
            WHEN column_name = 'date' THEN 7
            ELSE 99
        END
    """


def connect() -> tuple[duckdb.DuckDBPyConnection, str]:
    load_dotenv_if_present()
    project_root = Path(__file__).resolve().parent.parent
    warehouse_raw = os.environ.get(
        "WAREHOUSE_DUCKDB_PATH",
        os.environ.get("MOTHERDUCK_PATH", "/tmp/browserbase_warehouse.duckdb"),
    )
    analytics_raw = os.environ.get(
        "ANALYTICS_DUCKDB_PATH",
        "/tmp/browserbase_analytics.duckdb",
    )
    token = os.environ.get("MOTHERDUCK_TOKEN", "")

    warehouse_path = resolve_path(warehouse_raw, project_root)
    analytics_path = resolve_path(analytics_raw, project_root)

    kwargs: dict = {}
    if warehouse_path.startswith("md:") and token:
        kwargs["config"] = {"motherduck_token": token}
    try:
        conn = duckdb.connect(warehouse_path, read_only=True, **kwargs)
    except duckdb.Error:
        # Fallback to scratch DuckDB paths when MotherDuck is unavailable.
        local_warehouse = "/tmp/browserbase_warehouse.duckdb"
        local_analytics = "/tmp/browserbase_analytics.duckdb"
        try:
            conn = duckdb.connect(local_warehouse, read_only=True)
        except duckdb.Error:
            # If locked, copy DB files to a temp dir for read-only freshness checks.
            temp_dir = Path(tempfile.mkdtemp(prefix="bb_freshness_"))
            temp_warehouse = temp_dir / "warehouse.duckdb"
            temp_analytics = temp_dir / "analytics.duckdb"
            shutil.copy2(local_warehouse, temp_warehouse)
            if Path(local_analytics).exists():
                shutil.copy2(local_analytics, temp_analytics)
            conn = duckdb.connect(str(temp_warehouse), read_only=True)
            local_analytics = str(temp_analytics)
        try:
            conn.execute(f"ATTACH '{local_analytics}' AS analytics")
        except duckdb.Error:
            pass
        return conn, "analytics."

    relation_prefix = ""
    if not warehouse_path.startswith("md:"):
        try:
            conn.execute(f"ATTACH '{analytics_path}' AS analytics")
            relation_prefix = "analytics."
        except duckdb.Error:
            relation_prefix = "analytics."

    return conn, relation_prefix


def check_freshness() -> tuple[bool, list[dict]]:
    thresholds = parse_thresholds(os.environ.get("FRESHNESS_THRESHOLDS_JSON"))
    threshold_map = {item.name: item.max_age_hours for item in thresholds}
    schema_filter = ", ".join(f"'{name}'" for name in threshold_map)

    conn, relation_prefix = connect()
    now = datetime.now(timezone.utc)
    empty_is_stale = os.environ.get("FRESHNESS_EMPTY_IS_STALE", "false").lower() == "true"
    rows_out: list[dict] = []
    try:
        targets = conn.execute(
            f"""
            WITH ranked AS (
                SELECT
                    table_schema,
                    table_name,
                    column_name,
                    {freshness_column_expr()} AS priority
                FROM information_schema.columns
                WHERE table_schema IN ({schema_filter})
                  AND column_name IN (
                    '_loaded_at', '_calculated_at', 'triggered_at', '_synced_at', 'metric_date', 'as_of_date', 'date'
                  )
            )
            SELECT table_schema, table_name, column_name
            FROM ranked
            QUALIFY ROW_NUMBER() OVER (PARTITION BY table_schema, table_name ORDER BY priority) = 1
            ORDER BY table_schema, table_name
            """
        ).fetchall()

        analytics_schemas = {"growth", "product", "finance", "eng", "ops", "core"}
        for schema_name, table_name, freshness_col in targets:
            if relation_prefix and schema_name in analytics_schemas:
                relation = f'{relation_prefix}"{schema_name}"."{table_name}"'
            else:
                relation = f'"{schema_name}"."{table_name}"'
            result = conn.execute(
                f"""
                SELECT
                    MAX(CAST("{freshness_col}" AS TIMESTAMP)) AS freshest_at,
                    COUNT(*) AS row_count
                FROM {relation}
                """
            ).fetchone()
            freshest = result[0]
            row_count = int(result[1] or 0)
            max_age = threshold_map[schema_name]
            stale = True
            age_hours = None
            if freshest is not None:
                age_hours = (now.replace(tzinfo=None) - freshest).total_seconds() / 3600.0
                stale = age_hours > max_age
            elif row_count == 0 and not empty_is_stale:
                stale = False

            rows_out.append(
                {
                    "schema": schema_name,
                    "table": table_name,
                    "freshness_column": freshness_col,
                    "freshest_at": freshest.isoformat() if freshest else None,
                    "row_count": row_count,
                    "age_hours": None if age_hours is None else round(age_hours, 2),
                    "max_age_hours": max_age,
                    "stale": stale,
                }
            )
    finally:
        conn.close()

    has_stale = any(row["stale"] for row in rows_out)
    return (not has_stale), rows_out


def send_alert(message: str, payload: dict) -> None:
    webhook = os.environ.get("ALERT_WEBHOOK_URL", "").strip()
    if not webhook:
        return
    requests.post(webhook, json={"text": message, "details": payload}, timeout=15)


def main() -> None:
    parser = argparse.ArgumentParser(description="Freshness checker for BrowserBase data platform.")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args()

    ok, details = check_freshness()
    stale_tables = [d for d in details if d["stale"]]

    if args.format == "json":
        print(json.dumps({"ok": ok, "stale_tables": stale_tables, "tables": details}, indent=2))
    else:
        print("Freshness check:", "PASS" if ok else "FAIL")
        for row in stale_tables:
            print(
                f"- {row['schema']}.{row['table']} age={row['age_hours']}h "
                f"threshold={row['max_age_hours']}h freshest_at={row['freshest_at']}"
            )

    if not ok:
        send_alert(
            f"[BrowserBase] Freshness check failed ({len(stale_tables)} stale tables).",
            {"stale_tables": stale_tables},
        )
        raise SystemExit(1)


if __name__ == "__main__":
    main()
