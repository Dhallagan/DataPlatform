#!/usr/bin/env python3
"""
Seed deterministic GTM data into Supabase gtm schema via PostgREST.

Requirements:
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- gtm schema created and exposed in Supabase Data API
"""

import os
import sys
import uuid
from datetime import UTC, datetime, timedelta

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DEMO_NAMESPACE = uuid.UUID("f0f3ec41-cd7a-4a5c-a43c-3ac7d38e70bb")


def deterministic_id(label: str) -> str:
    return str(uuid.uuid5(DEMO_NAMESPACE, label))


def ts(dt: datetime) -> str:
    return dt.astimezone(UTC).replace(microsecond=0).isoformat()


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def rest_get(rest_url: str, headers: dict, path: str) -> list[dict]:
    resp = requests.get(f"{rest_url}{path}", headers=headers, timeout=30, verify=False)
    if resp.status_code != 200:
        raise RuntimeError(f"GET {path} failed: {resp.status_code} {resp.text[:400]}")
    return resp.json()


def rest_upsert(rest_url: str, headers: dict, table: str, rows: list[dict]) -> None:
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
        raise RuntimeError(f"Upsert {table} failed: {resp.status_code} {resp.text[:400]}")


def main() -> None:
    url = require_env("SUPABASE_URL").rstrip("/")
    key = require_env("SUPABASE_SERVICE_KEY")
    rest_url = f"{url}/rest/v1"

    public_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    gtm_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept-Profile": "gtm",
        "Content-Profile": "gtm",
    }

    orgs = rest_get(
        rest_url,
        public_headers,
        "/organizations?select=id,name,slug&order=created_at.asc&limit=12",
    )
    users = rest_get(
        rest_url,
        public_headers,
        "/users?select=id,full_name,email&order=created_at.asc&limit=24",
    )
    if not orgs:
        raise RuntimeError("No organizations found. Seed base BrowserBase data first.")
    if not users:
        raise RuntimeError("No users found. Seed base BrowserBase data first.")

    now = datetime.now(UTC)

    campaigns: list[dict] = []
    for i, (name, channel, status, objective, budget) in enumerate(
        [
            ("Outbound Q1", "outbound", "active", "pipeline", 22000.0),
            ("SEO Content", "inbound", "active", "MQL volume", 9000.0),
            ("Partner Webinar", "partner", "planned", "enterprise leads", 7000.0),
            ("Retargeting", "paid", "active", "demo bookings", 6000.0),
        ],
        start=1,
    ):
        campaigns.append(
            {
                "id": deterministic_id(f"gtm:campaign:{i}"),
                "name": name,
                "channel": channel,
                "objective": objective,
                "status": status,
                "budget_usd": budget,
                "start_date": (now - timedelta(days=45 - (i * 7))).date().isoformat(),
                "end_date": (now + timedelta(days=30 + (i * 7))).date().isoformat(),
                "owner_user_id": users[(i - 1) % len(users)]["id"],
                "created_at": ts(now - timedelta(days=60 - i)),
                "updated_at": ts(now - timedelta(days=max(1, i))),
            }
        )

    accounts: list[dict] = []
    contacts: list[dict] = []
    leads: list[dict] = []
    lead_touches: list[dict] = []
    opportunities: list[dict] = []
    activities: list[dict] = []

    lead_sources = ["outbound", "inbound", "partner", "paid"]
    lead_statuses = ["new", "working", "qualified", "disqualified"]
    opp_stages = ["prospecting", "demo_scheduled", "proposal", "negotiation", "closed_won", "closed_lost"]
    outcomes = ["connected", "demo_booked", "no_show", "follow_up_sent", "proposal_sent"]

    for idx, org in enumerate(orgs, start=1):
        owner = users[(idx - 1) % len(users)]
        campaign = campaigns[(idx - 1) % len(campaigns)]
        account_id = deterministic_id(f"gtm:account:{org['id']}")
        contact_id = deterministic_id(f"gtm:contact:{org['id']}")
        lead_id = deterministic_id(f"gtm:lead:{org['id']}")
        opp_id = deterministic_id(f"gtm:opp:{org['id']}")

        source = lead_sources[(idx - 1) % len(lead_sources)]
        lead_status = lead_statuses[(idx - 1) % len(lead_statuses)]
        stage = opp_stages[(idx - 1) % len(opp_stages)]
        won = stage == "closed_won"
        lost = stage == "closed_lost"
        amount = float(12000 + (idx * 3500))
        created = now - timedelta(days=40 - min(idx, 30))
        touch_time = now - timedelta(days=24 - min(idx, 20))
        expected_close = (now + timedelta(days=30 - min(idx, 20))).date().isoformat()

        accounts.append(
            {
                "id": account_id,
                "organization_id": org["id"],
                "name": f"{org['name']} Buying Team",
                "website_domain": f"{org['slug']}.example.com",
                "industry": ["SaaS", "Fintech", "Ecommerce", "Healthcare"][(idx - 1) % 4],
                "employee_band": ["11-50", "51-200", "201-500", "501-1000"][(idx - 1) % 4],
                "account_tier": ["A", "B", "C"][(idx - 1) % 3],
                "account_status": "customer" if won else "target",
                "owner_user_id": owner["id"],
                "source_system": "salesforce_sim",
                "created_at": ts(created),
                "updated_at": ts(now - timedelta(days=min(idx, 10))),
            }
        )

        contacts.append(
            {
                "id": contact_id,
                "account_id": account_id,
                "email": f"buyer+{org['slug']}@example.com",
                "full_name": owner.get("full_name") or f"Buyer {idx}",
                "title": ["Head of Eng", "CTO", "VP Product", "Ops Lead"][(idx - 1) % 4],
                "department": ["Engineering", "Product", "Operations"][(idx - 1) % 3],
                "seniority": ["director", "vp", "c_level"][(idx - 1) % 3],
                "lifecycle_stage": "customer" if won else "opportunity",
                "is_primary_contact": True,
                "created_at": ts(created + timedelta(hours=3)),
                "updated_at": ts(now - timedelta(days=min(idx, 8))),
            }
        )

        leads.append(
            {
                "id": lead_id,
                "account_id": account_id,
                "contact_id": contact_id,
                "lead_source": source,
                "lead_status": lead_status,
                "source_detail": campaign["name"],
                "score": min(100, 35 + (idx * 5)),
                "owner_user_id": owner["id"],
                "first_touch_at": ts(created + timedelta(days=2)),
                "converted_at": ts(created + timedelta(days=10)) if lead_status in ("qualified",) or won else None,
                "created_at": ts(created + timedelta(days=1)),
                "updated_at": ts(now - timedelta(days=min(idx, 6))),
            }
        )

        lead_touches.append(
            {
                "id": deterministic_id(f"gtm:touch:{org['id']}"),
                "lead_id": lead_id,
                "campaign_id": campaign["id"],
                "touch_type": "email_open",
                "touch_at": ts(touch_time),
                "channel": campaign["channel"],
                "metadata": {"cta": "book_demo", "variant": f"A{((idx - 1) % 3) + 1}"},
                "created_at": ts(touch_time),
            }
        )

        opportunities.append(
            {
                "id": opp_id,
                "account_id": account_id,
                "primary_contact_id": contact_id,
                "originating_lead_id": lead_id,
                "opportunity_name": f"{org['name']} - Browser Sessions Expansion",
                "stage": stage,
                "amount_usd": amount,
                "forecast_category": "commit" if stage in ("negotiation", "closed_won") else "pipeline",
                "expected_close_date": expected_close,
                "closed_at": ts(now - timedelta(days=2)) if (won or lost) else None,
                "is_won": True if won else (False if lost else None),
                "loss_reason": "no_budget" if lost else None,
                "owner_user_id": owner["id"],
                "created_at": ts(created + timedelta(days=12)),
                "updated_at": ts(now - timedelta(days=min(idx, 5))),
            }
        )

        for n in range(2):
            occurred = now - timedelta(days=14 - min(idx, 10), hours=n * 6)
            activities.append(
                {
                    "id": deterministic_id(f"gtm:activity:{org['id']}:{n+1}"),
                    "account_id": account_id,
                    "contact_id": contact_id,
                    "lead_id": lead_id,
                    "opportunity_id": opp_id,
                    "activity_type": "call" if n == 0 else "email",
                    "direction": "outbound",
                    "subject": f"{'Discovery call' if n == 0 else 'Follow-up'} - {org['name']}",
                    "outcome": outcomes[(idx + n - 1) % len(outcomes)],
                    "occurred_at": ts(occurred),
                    "owner_user_id": owner["id"],
                    "created_at": ts(occurred),
                }
            )

    # Validate that gtm schema is available over API before upserts.
    probe = requests.get(
        f"{rest_url}/accounts?select=id&limit=1",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept-Profile": "gtm"},
        timeout=30,
        verify=False,
    )
    if probe.status_code == 406:
        raise RuntimeError(
            "Supabase API does not expose gtm schema yet. "
            "Add gtm to exposed schemas in Settings -> API."
        )
    if probe.status_code not in (200,):
        raise RuntimeError(f"GTM probe failed: {probe.status_code} {probe.text[:400]}")

    rest_upsert(rest_url, gtm_headers, "campaigns", campaigns)
    rest_upsert(rest_url, gtm_headers, "accounts", accounts)
    rest_upsert(rest_url, gtm_headers, "contacts", contacts)
    rest_upsert(rest_url, gtm_headers, "leads", leads)
    rest_upsert(rest_url, gtm_headers, "lead_touches", lead_touches)
    rest_upsert(rest_url, gtm_headers, "opportunities", opportunities)
    rest_upsert(rest_url, gtm_headers, "activities", activities)

    print("Seeded GTM data:")
    print(f"  campaigns:     {len(campaigns)}")
    print(f"  accounts:      {len(accounts)}")
    print(f"  contacts:      {len(contacts)}")
    print(f"  leads:         {len(leads)}")
    print(f"  lead_touches:  {len(lead_touches)}")
    print(f"  opportunities: {len(opportunities)}")
    print(f"  activities:    {len(activities)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)
