#!/usr/bin/env python3
"""
Seed deterministic trial-conversion-risk scenarios into local DuckDB bronze tables.

Use this when remote Supabase is unavailable but you still need end-to-end
signal workflow validation in the warehouse.
"""

import argparse
import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone

import duckdb

DEMO_NAMESPACE = uuid.UUID("8f44f4da-c08a-41be-80bc-3666c57f22e2")


def deterministic_id(label: str) -> str:
    return str(uuid.uuid5(DEMO_NAMESPACE, label))


def ts(dt: datetime) -> datetime:
    return dt.astimezone(timezone.utc).replace(tzinfo=None, microsecond=0)


def get_plan_id(conn: duckdb.DuckDBPyConnection) -> str:
    candidates = ["starter", "pro", "free"]
    for name in candidates:
        row = conn.execute(
            "SELECT id FROM bronze_supabase.plans WHERE lower(name) = ? LIMIT 1",
            [name],
        ).fetchone()
        if row:
            return row[0]
    row = conn.execute("SELECT id FROM bronze_supabase.plans LIMIT 1").fetchone()
    if row:
        return row[0]
    raise RuntimeError("No plans found in bronze_supabase.plans")


def seed(conn: duckdb.DuckDBPyConnection, count: int) -> None:
    plan_id = get_plan_id(conn)
    now = datetime.now(timezone.utc)

    for i in range(1, count + 1):
        slug = f"trial-signal-demo-{i}"
        org_id = deterministic_id(f"org:{slug}")
        user_id = deterministic_id(f"user:{slug}")
        member_id = deterministic_id(f"member:{slug}")
        key_id = deterministic_id(f"api_key:{slug}")
        project_id = deterministic_id(f"project:{slug}")
        subscription_id = deterministic_id(f"subscription:{slug}")

        org_created = ts(now - timedelta(days=7 + i))
        trial_ends = ts(now + timedelta(days=min(2 + i, 5)))
        period_start = ts(now - timedelta(days=9))
        period_end = ts(now + timedelta(days=21))

        conn.execute("DELETE FROM bronze_supabase.organization_members WHERE id = ?", [member_id])
        conn.execute("DELETE FROM bronze_supabase.api_keys WHERE id = ?", [key_id])
        conn.execute("DELETE FROM bronze_supabase.projects WHERE id = ?", [project_id])
        conn.execute("DELETE FROM bronze_supabase.subscriptions WHERE id = ?", [subscription_id])
        conn.execute("DELETE FROM bronze_supabase.users WHERE id = ?", [user_id])
        conn.execute("DELETE FROM bronze_supabase.organizations WHERE id = ?", [org_id])

        conn.execute(
            """
            INSERT INTO bronze_supabase.organizations (
                id, name, slug, stripe_customer_id, billing_email, status, created_at, updated_at, _synced_at
            ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, CURRENT_TIMESTAMP)
            """,
            [org_id, f"Trial Signal Demo {i}", slug, f"cus_trial_demo_{i}", f"billing+{slug}@browserbase-demo.dev", org_created, ts(now)],
        )

        conn.execute(
            """
            INSERT INTO bronze_supabase.users (
                id, email, full_name, avatar_url, auth_provider, email_verified, status,
                created_at, updated_at, last_login_at, _synced_at
            ) VALUES (?, ?, ?, NULL, 'email', TRUE, 'active', ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            [user_id, f"owner+{slug}@browserbase-demo.dev", f"Trial Demo Owner {i}", org_created, ts(now), ts(now - timedelta(days=1))],
        )

        conn.execute(
            """
            INSERT INTO bronze_supabase.organization_members (
                id, organization_id, user_id, role, invited_at, joined_at, _synced_at
            ) VALUES (?, ?, ?, 'owner', ?, ?, CURRENT_TIMESTAMP)
            """,
            [member_id, org_id, user_id, org_created, org_created],
        )

        conn.execute(
            """
            INSERT INTO bronze_supabase.api_keys (
                id, organization_id, created_by, name, key_prefix, key_hash, scopes, status,
                last_used_at, expires_at, created_at, revoked_at, _synced_at
            ) VALUES (?, ?, ?, 'Demo Trial Key', ?, ?, ['sessions:read','sessions:write'], 'active',
                     ?, NULL, ?, NULL, CURRENT_TIMESTAMP)
            """,
            [
                key_id,
                org_id,
                user_id,
                f"bbdemo{i}",
                hashlib.sha256(f"bbdemo:{slug}".encode("utf-8")).hexdigest(),
                ts(now - timedelta(days=1)),
                org_created,
            ],
        )

        conn.execute(
            """
            INSERT INTO bronze_supabase.projects (
                id, organization_id, name, description, default_timeout_mins, default_viewport_width,
                default_viewport_height, status, created_at, updated_at, _synced_at
            ) VALUES (?, ?, 'Trial Conversion Workflow',
                     'Demo project for trial conversion signal validation',
                     30, 1280, 720, 'active', ?, ?, CURRENT_TIMESTAMP)
            """,
            [project_id, org_id, org_created, ts(now)],
        )

        conn.execute(
            """
            INSERT INTO bronze_supabase.subscriptions (
                id, organization_id, plan_id, status, stripe_subscription_id, trial_ends_at,
                current_period_start, current_period_end, canceled_at, created_at, updated_at, _synced_at
            ) VALUES (?, ?, ?, 'trialing', ?, ?, ?, ?, NULL, ?, ?, CURRENT_TIMESTAMP)
            """,
            [subscription_id, org_id, plan_id, f"sub_trial_demo_{i}", trial_ends, period_start, period_end, org_created, ts(now)],
        )

        # Scenario 1: no sessions.
        if i == 1:
            continue

        if i == 2:
            statuses = ["failed", "timeout"]
        else:
            statuses = ["completed", "failed", "failed"]

        for n, status in enumerate(statuses, start=1):
            session_id = deterministic_id(f"session:{slug}:{n}")
            event_id = deterministic_id(f"event:{slug}:{n}:error")
            start_ts = ts(now - timedelta(days=1 + (i % 2), hours=n))
            end_ts = ts(start_ts + timedelta(minutes=5))

            conn.execute("DELETE FROM bronze_supabase.session_events WHERE id = ?", [event_id])
            conn.execute("DELETE FROM bronze_supabase.browser_sessions WHERE id = ?", [session_id])

            conn.execute(
                """
                INSERT INTO bronze_supabase.browser_sessions (
                    id, organization_id, project_id, api_key_id, browser_type, viewport_width, viewport_height,
                    proxy_type, proxy_country, stealth_mode, status, started_at, ended_at, timeout_at,
                    user_agent, initial_url, pages_visited, bytes_downloaded, bytes_uploaded,
                    created_at, updated_at, _synced_at
                ) VALUES (?, ?, ?, ?, 'chromium', 1280, 720, NULL, NULL, FALSE, ?, ?, ?, ?, 'Mozilla/5.0',
                          'https://example.com', 2, 80000, 12000, ?, ?, CURRENT_TIMESTAMP)
                """,
                [
                    session_id,
                    org_id,
                    project_id,
                    key_id,
                    status,
                    start_ts,
                    end_ts,
                    end_ts if status == "timeout" else None,
                    start_ts,
                    end_ts,
                ],
            )

            if status != "completed":
                conn.execute(
                    """
                    INSERT INTO bronze_supabase.session_events (
                        id, session_id, event_type, event_data, page_url, page_title, timestamp, _synced_at
                    ) VALUES (?, ?, 'error', '{"message":"demo_failure"}', 'https://example.com',
                              'Demo Failure', ?, CURRENT_TIMESTAMP)
                    """,
                    [event_id, session_id, end_ts],
                )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed local DuckDB trial signal demo scenarios.")
    parser.add_argument("--count", type=int, default=3, help="Number of demo trial organizations.")
    args = parser.parse_args()

    warehouse_path = os.environ.get("WAREHOUSE_DUCKDB_PATH", "pipeline/warehouse.duckdb")
    conn = duckdb.connect(warehouse_path)
    try:
        seed(conn, args.count)
        conn.commit()
    finally:
        conn.close()

    print(f"Seeded {args.count} trial signal scenario organizations into {warehouse_path}.")


if __name__ == "__main__":
    main()
