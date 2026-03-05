#!/usr/bin/env python3
"""
Seed deterministic trial-conversion-risk scenarios into Supabase.

Purpose:
- Create a small set of active trialing organizations that trigger
  `signal_trial_conversion_risk_daily`.
- Keep inserts idempotent via upserts on `id`.
"""

import argparse
import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DEMO_NAMESPACE = uuid.UUID("f0f3ec41-cd7a-4a5c-a43c-3ac7d38e70bb")


def ts(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat()


def deterministic_id(label: str) -> str:
    return str(uuid.uuid5(DEMO_NAMESPACE, label))


def upsert(rest_url: str, headers: dict, table: str, rows: list[dict]) -> None:
    if not rows:
        return
    resp = requests.post(
        f"{rest_url}/{table}?on_conflict=id",
        headers=headers,
        json=rows,
        timeout=30,
        verify=False,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Upsert failed for {table}: {resp.status_code} {resp.text[:400]}")


def get_plan_id(rest_url: str, headers: dict) -> str:
    for query in (
        "/plans?select=id&name=eq.starter&limit=1",
        "/plans?select=id&name=eq.pro&limit=1",
        "/plans?select=id&name=eq.free&limit=1",
        "/plans?select=id&limit=1",
    ):
        resp = requests.get(f"{rest_url}{query}", headers=headers, timeout=30, verify=False)
        if resp.status_code != 200:
            continue
        rows = resp.json()
        if rows:
            return rows[0]["id"]
    raise RuntimeError("No plan found in Supabase. Seed plans first.")


def build_scenario_rows(count: int, plan_id: str) -> dict[str, list[dict]]:
    now = datetime.now(timezone.utc)
    rows: dict[str, list[dict]] = {
        "organizations": [],
        "users": [],
        "organization_members": [],
        "api_keys": [],
        "projects": [],
        "subscriptions": [],
        "browser_sessions": [],
        "session_events": [],
        "activities": [],
    }

    for i in range(1, count + 1):
        slug = f"trial-signal-demo-{i}"
        org_id = deterministic_id(f"org:{slug}")
        user_id = deterministic_id(f"user:{slug}")
        member_id = deterministic_id(f"member:{slug}")
        key_id = deterministic_id(f"api_key:{slug}")
        project_id = deterministic_id(f"project:{slug}")
        subscription_id = deterministic_id(f"subscription:{slug}")

        org_created = now - timedelta(days=7 + i)
        trial_ends = now + timedelta(days=min(2 + i, 5))
        period_start = now - timedelta(days=9)
        period_end = now + timedelta(days=21)

        rows["organizations"].append(
            {
                "id": org_id,
                "name": f"Trial Signal Demo {i}",
                "slug": slug,
                "stripe_customer_id": f"cus_trial_demo_{i}",
                "billing_email": f"billing+{slug}@browserbase-demo.dev",
                "status": "active",
                "created_at": ts(org_created),
                "updated_at": ts(now),
            }
        )

        rows["users"].append(
            {
                "id": user_id,
                "email": f"owner+{slug}@browserbase-demo.dev",
                "full_name": f"Trial Demo Owner {i}",
                "auth_provider": "email",
                "email_verified": True,
                "status": "active",
                "created_at": ts(org_created),
                "updated_at": ts(now),
                "last_login_at": ts(now - timedelta(days=1)),
            }
        )

        rows["organization_members"].append(
            {
                "id": member_id,
                "organization_id": org_id,
                "user_id": user_id,
                "role": "owner",
                "invited_at": ts(org_created),
                "joined_at": ts(org_created),
            }
        )

        rows["api_keys"].append(
            {
                "id": key_id,
                "organization_id": org_id,
                "created_by": user_id,
                "name": "Demo Trial Key",
                "key_prefix": f"bbdemo{i}",
                "key_hash": hashlib.sha256(f"bbdemo:{slug}".encode("utf-8")).hexdigest(),
                "scopes": ["sessions:read", "sessions:write"],
                "status": "active",
                "created_at": ts(org_created),
            }
        )

        rows["projects"].append(
            {
                "id": project_id,
                "organization_id": org_id,
                "name": "Trial Conversion Workflow",
                "description": "Demo project for trial conversion signal validation",
                "default_timeout_mins": 30,
                "default_viewport_width": 1280,
                "default_viewport_height": 720,
                "status": "active",
                "created_at": ts(org_created),
                "updated_at": ts(now),
            }
        )

        rows["subscriptions"].append(
            {
                "id": subscription_id,
                "organization_id": org_id,
                "plan_id": plan_id,
                "status": "trialing",
                "stripe_subscription_id": f"sub_trial_demo_{i}",
                "trial_ends_at": ts(trial_ends),
                "current_period_start": ts(period_start),
                "current_period_end": ts(period_end),
                "canceled_at": None,
                "created_at": ts(org_created),
                "updated_at": ts(now),
            }
        )

        signal_id = f"{org_id}|{now.date().isoformat()}|trial_conversion_risk"
        task_id = f"growth_task|{signal_id}"
        activity_status = "failed" if i % 5 == 0 else "success"
        error_token = "error=rate_limited_destination" if activity_status == "failed" else "error="
        rows["activities"].append(
            {
                "id": deterministic_id(f"activity:wheel:{slug}"),
                "account_id": None,
                "contact_id": None,
                "lead_id": None,
                "opportunity_id": None,
                "activity_type": "workflow_execution",
                "direction": "system",
                "subject": (
                    f"wheel_execution|organization_id={org_id}|task_id={task_id}|signal_id={signal_id}"
                    f"|action_type=intervene_trial_conversion|destination=hubspot|{error_token}"
                ),
                "outcome": activity_status,
                "occurred_at": ts(now - timedelta(minutes=max(2, i))),
                "owner_user_id": user_id,
                "created_at": ts(now - timedelta(minutes=max(2, i))),
            }
        )

        # Scenario 1: no sessions (no_recent_usage)
        if i == 1:
            continue

        # Scenario 2: only failed/timeout sessions (no_successful_runs)
        if i == 2:
            for n, status in enumerate(["failed", "timeout"], start=1):
                session_id = deterministic_id(f"session:{slug}:{n}")
                start_ts = now - timedelta(days=1, hours=n)
                end_ts = start_ts + timedelta(minutes=3)
                rows["browser_sessions"].append(
                    {
                        "id": session_id,
                        "organization_id": org_id,
                        "project_id": project_id,
                        "api_key_id": key_id,
                        "browser_type": "chromium",
                        "viewport_width": 1280,
                        "viewport_height": 720,
                        "proxy_type": None,
                        "proxy_country": None,
                        "stealth_mode": False,
                        "status": status,
                        "started_at": ts(start_ts),
                        "ended_at": ts(end_ts),
                        "timeout_at": ts(end_ts) if status == "timeout" else None,
                        "user_agent": "Mozilla/5.0",
                        "initial_url": "https://example.com",
                        "pages_visited": 1,
                        "bytes_downloaded": 50000,
                        "bytes_uploaded": 8000,
                        "created_at": ts(start_ts),
                        "updated_at": ts(end_ts),
                    }
                )
                rows["session_events"].append(
                    {
                        "id": deterministic_id(f"event:{slug}:{n}:error"),
                        "session_id": session_id,
                        "event_type": "error",
                        "event_data": {"message": "demo_error"},
                        "page_url": "https://example.com",
                        "page_title": "Demo Error",
                        "timestamp": ts(end_ts),
                    }
                )
            continue

        # Scenario >=3: low success rate (< 50%)
        for n, status in enumerate(["completed", "failed", "failed"], start=1):
            session_id = deterministic_id(f"session:{slug}:{n}")
            start_ts = now - timedelta(days=2, hours=n)
            end_ts = start_ts + timedelta(minutes=5)
            rows["browser_sessions"].append(
                {
                    "id": session_id,
                    "organization_id": org_id,
                    "project_id": project_id,
                    "api_key_id": key_id,
                    "browser_type": "chromium",
                    "viewport_width": 1280,
                    "viewport_height": 720,
                    "proxy_type": None,
                    "proxy_country": None,
                    "stealth_mode": False,
                    "status": status,
                    "started_at": ts(start_ts),
                    "ended_at": ts(end_ts),
                    "timeout_at": None,
                    "user_agent": "Mozilla/5.0",
                    "initial_url": "https://example.com",
                    "pages_visited": 2,
                    "bytes_downloaded": 80000,
                    "bytes_uploaded": 12000,
                    "created_at": ts(start_ts),
                    "updated_at": ts(end_ts),
                }
            )
            if status != "completed":
                rows["session_events"].append(
                    {
                        "id": deterministic_id(f"event:{slug}:{n}:error"),
                        "session_id": session_id,
                        "event_type": "error",
                        "event_data": {"message": "demo_low_success"},
                        "page_url": "https://example.com",
                        "page_title": "Demo Failure",
                        "timestamp": ts(end_ts),
                    }
                )

    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed trial-risk demo scenarios to Supabase.")
    parser.add_argument("--count", type=int, default=3, help="Number of demo trial organizations to create.")
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not supabase_url or not supabase_key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.")

    rest_url = f"{supabase_url.rstrip('/')}/rest/v1"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal,resolution=merge-duplicates",
    }
    gtm_headers = {
        **headers,
        "Accept-Profile": "gtm",
        "Content-Profile": "gtm",
    }

    plan_id = get_plan_id(rest_url, headers)
    rows = build_scenario_rows(args.count, plan_id)

    # Dependency order to satisfy FK constraints.
    upsert(rest_url, headers, "organizations", rows["organizations"])
    upsert(rest_url, headers, "users", rows["users"])
    upsert(rest_url, headers, "organization_members", rows["organization_members"])
    upsert(rest_url, headers, "api_keys", rows["api_keys"])
    upsert(rest_url, headers, "projects", rows["projects"])
    upsert(rest_url, headers, "subscriptions", rows["subscriptions"])
    upsert(rest_url, headers, "browser_sessions", rows["browser_sessions"])
    upsert(rest_url, headers, "session_events", rows["session_events"])
    upsert(rest_url, gtm_headers, "activities", rows["activities"])

    print("Seeded trial signal scenarios successfully.")
    print(f"organizations={len(rows['organizations'])}, subscriptions={len(rows['subscriptions'])}")
    print(f"sessions={len(rows['browser_sessions'])}, events={len(rows['session_events'])}")
    print(f"activities={len(rows['activities'])}")


if __name__ == "__main__":
    main()
