#!/usr/bin/env python3
"""
Seed deterministic finance data (Ramp-like) into Supabase finance schema.

Requirements:
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- finance schema created and exposed in Supabase Data API
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
    upsert_headers = dict(headers)
    upsert_headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
    resp = requests.post(
        f"{rest_url}/{table}?on_conflict=id",
        headers=upsert_headers,
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
    finance_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept-Profile": "finance",
        "Content-Profile": "finance",
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
    if not orgs or not users:
        raise RuntimeError("No organizations/users found. Seed base BrowserBase data first.")

    now = datetime.now(UTC)

    departments: list[dict] = []
    vendors: list[dict] = []
    cards: list[dict] = []
    transactions: list[dict] = []
    reimbursements: list[dict] = []
    bills: list[dict] = []
    bill_payments: list[dict] = []
    bill_adjustments: list[dict] = []
    payment_reversals: list[dict] = []

    vendor_templates = [
        ("aws", "cloud_infra", "net_30"),
        ("openai", "ai_tools", "net_30"),
        ("notion", "software_saas", "net_30"),
        ("cursor", "developer_tools", "net_15"),
        ("google_ads", "marketing", "net_15"),
        ("linkedin_ads", "marketing", "net_15"),
    ]

    for idx, org in enumerate(orgs, start=1):
        org_id = org["id"]
        owner_id = users[(idx - 1) % len(users)]["id"]
        dept_count = 3

        dept_ids = []
        for d in range(1, dept_count + 1):
            dept_id = deterministic_id(f"finance:dept:{org_id}:{d}")
            dept_ids.append(dept_id)
            departments.append(
                {
                    "id": dept_id,
                    "organization_id": org_id,
                    "name": ["engineering", "growth", "g&a"][d - 1],
                    "cost_center": f"CC-{idx:02d}{d:02d}",
                    "budget_usd": float(20000 + d * 12000 + idx * 500),
                    "owner_user_id": owner_id,
                    "status": "active",
                    "created_at": ts(now - timedelta(days=90 - d)),
                    "updated_at": ts(now - timedelta(days=d)),
                }
            )

        vendor_ids = []
        for v_idx, (name, category, terms) in enumerate(vendor_templates, start=1):
            vendor_id = deterministic_id(f"finance:vendor:{org_id}:{v_idx}")
            vendor_ids.append(vendor_id)
            vendors.append(
                {
                    "id": vendor_id,
                    "organization_id": org_id,
                    "vendor_name": name,
                    "category": category,
                    "status": "active",
                    "payment_terms": terms,
                    "risk_level": ["low", "medium", "high"][v_idx % 3],
                    "country": "US",
                    "currency": "USD",
                    "created_at": ts(now - timedelta(days=120 - v_idx)),
                    "updated_at": ts(now - timedelta(days=v_idx)),
                }
            )

        card_ids = []
        for c in range(1, 4):
            card_id = deterministic_id(f"finance:card:{org_id}:{c}")
            card_ids.append(card_id)
            cards.append(
                {
                    "id": card_id,
                    "organization_id": org_id,
                    "card_last4": f"{4400 + (idx * 10) + c}",
                    "card_brand": ["visa", "mastercard", "amex"][c - 1],
                    "card_type": "virtual" if c < 3 else "physical",
                    "cardholder_user_id": users[(idx + c - 1) % len(users)]["id"],
                    "department_id": dept_ids[(c - 1) % len(dept_ids)],
                    "vendor_id": vendor_ids[(c - 1) % len(vendor_ids)],
                    "spend_limit_usd": float(3000 + c * 2500),
                    "status": "active",
                    "issued_at": ts(now - timedelta(days=75 - c)),
                    "frozen_at": None,
                    "created_at": ts(now - timedelta(days=75 - c)),
                    "updated_at": ts(now - timedelta(days=c)),
                }
            )

        for t in range(1, 9):
            txn_id = deterministic_id(f"finance:txn:{org_id}:{t}")
            vendor_id = vendor_ids[(t - 1) % len(vendor_ids)]
            dept_id = dept_ids[(t - 1) % len(dept_ids)]
            card_id = card_ids[(t - 1) % len(card_ids)]
            txn_at = now - timedelta(days=35 - t * 2)
            status = ["posted", "cleared", "pending", "posted", "cleared", "posted", "declined", "posted"][
                t - 1
            ]
            transactions.append(
                {
                    "id": txn_id,
                    "organization_id": org_id,
                    "card_id": card_id,
                    "vendor_id": vendor_id,
                    "department_id": dept_id,
                    "merchant_name": vendor_templates[(t - 1) % len(vendor_templates)][0],
                    "merchant_category": vendor_templates[(t - 1) % len(vendor_templates)][1],
                    "amount_usd": float(120 + t * 85 + idx * 4),
                    "currency": "USD",
                    "transaction_type": "card_purchase",
                    "status": status,
                    "transaction_at": ts(txn_at),
                    "settled_at": ts(txn_at + timedelta(days=2)) if status in ("posted", "cleared") else None,
                    "memo": f"Auto-seeded spend txn {t}",
                    "receipt_url": None,
                    "created_by_user_id": users[(idx + t - 1) % len(users)]["id"],
                    "created_at": ts(txn_at),
                    "updated_at": ts(txn_at + timedelta(days=1)),
                }
            )

        for r in range(1, 3):
            reimb_id = deterministic_id(f"finance:reimb:{org_id}:{r}")
            submitted_at = now - timedelta(days=20 - r * 3)
            status = "paid" if r == 1 else "approved"
            reimbursements.append(
                {
                    "id": reimb_id,
                    "organization_id": org_id,
                    "submitted_by_user_id": users[(idx + r) % len(users)]["id"],
                    "department_id": dept_ids[r % len(dept_ids)],
                    "vendor_id": vendor_ids[r % len(vendor_ids)],
                    "amount_usd": float(180 + r * 95),
                    "currency": "USD",
                    "status": status,
                    "expense_date": (submitted_at - timedelta(days=1)).date().isoformat(),
                    "submitted_at": ts(submitted_at),
                    "approved_at": ts(submitted_at + timedelta(days=2)),
                    "paid_at": ts(submitted_at + timedelta(days=5)) if status == "paid" else None,
                    "memo": "Team travel reimbursement",
                    "created_at": ts(submitted_at),
                    "updated_at": ts(submitted_at + timedelta(days=2)),
                }
            )

        for b in range(1, 4):
            bill_id = deterministic_id(f"finance:bill:{org_id}:{b}")
            bill_payment_id = deterministic_id(f"finance:bill_payment:{org_id}:{b}")
            bill_date = now - timedelta(days=28 - b * 4)
            bill_status = ["approved", "scheduled", "paid"][b - 1]
            bills.append(
                {
                    "id": bill_id,
                    "organization_id": org_id,
                    "vendor_id": vendor_ids[(b + 2) % len(vendor_ids)],
                    "department_id": dept_ids[(b - 1) % len(dept_ids)],
                    "bill_number": f"BILL-{idx:02d}-{b:03d}",
                    "bill_date": bill_date.date().isoformat(),
                    "due_date": (bill_date + timedelta(days=15)).date().isoformat(),
                    "amount_usd": float(950 + b * 430),
                    "currency": "USD",
                    "status": bill_status,
                    "approved_by_user_id": owner_id,
                    "memo": "Recurring software/services bill",
                    "created_at": ts(bill_date),
                    "updated_at": ts(bill_date + timedelta(days=2)),
                }
            )

            payment_status = "paid" if bill_status == "paid" else "scheduled"
            bill_payments.append(
                {
                    "id": bill_payment_id,
                    "organization_id": org_id,
                    "bill_id": bill_id,
                    "payment_method": "ach",
                    "amount_usd": float(950 + b * 430),
                    "currency": "USD",
                    "paid_at": ts(bill_date + timedelta(days=10)) if payment_status == "paid" else None,
                    "status": payment_status,
                    "external_payment_id": f"pmt_{idx:02d}_{b:03d}",
                    "created_at": ts(bill_date + timedelta(days=3)),
                }
            )

            # Seed one decrease adjustment on approved bills and one increase adjustment
            # on scheduled bills to exercise AP netting logic.
            if b in (1, 2):
                bill_adjustments.append(
                    {
                        "id": deterministic_id(f"finance:bill_adjustment:{org_id}:{b}"),
                        "organization_id": org_id,
                        "bill_id": bill_id,
                        "adjustment_type": "credit_memo" if b == 1 else "other",
                        "direction": "decrease" if b == 1 else "increase",
                        "amount_usd": float(75 + b * 20),
                        "currency": "USD",
                        "reason": "Seeded adjustment for accounting workflow validation",
                        "adjusted_at": ts(bill_date + timedelta(days=5)),
                        "created_by_user_id": owner_id,
                        "created_at": ts(bill_date + timedelta(days=5)),
                    }
                )

            # Seed a completed reversal for paid bills to exercise net paid logic.
            if payment_status == "paid":
                payment_reversals.append(
                    {
                        "id": deterministic_id(f"finance:payment_reversal:{org_id}:{b}"),
                        "organization_id": org_id,
                        "original_payment_id": bill_payment_id,
                        "bill_id": bill_id,
                        "reversal_amount_usd": float(120 + b * 15),
                        "currency": "USD",
                        "status": "completed",
                        "reversal_reason": "Seeded payment reversal",
                        "reversed_at": ts(bill_date + timedelta(days=14)),
                        "created_by_user_id": owner_id,
                        "created_at": ts(bill_date + timedelta(days=14)),
                    }
                )

    probe = requests.get(
        f"{rest_url}/departments?select=id&limit=1",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept-Profile": "finance"},
        timeout=30,
        verify=False,
    )
    if probe.status_code == 406:
        raise RuntimeError(
            "Supabase API does not expose finance schema yet. "
            "Add finance to exposed schemas in Settings -> API."
        )
    if probe.status_code != 200:
        raise RuntimeError(f"Finance probe failed: {probe.status_code} {probe.text[:400]}")

    rest_upsert(rest_url, finance_headers, "departments", departments)
    rest_upsert(rest_url, finance_headers, "vendors", vendors)
    rest_upsert(rest_url, finance_headers, "cards", cards)
    rest_upsert(rest_url, finance_headers, "transactions", transactions)
    rest_upsert(rest_url, finance_headers, "reimbursements", reimbursements)
    rest_upsert(rest_url, finance_headers, "bills", bills)
    rest_upsert(rest_url, finance_headers, "bill_payments", bill_payments)
    rest_upsert(rest_url, finance_headers, "bill_adjustments", bill_adjustments)
    rest_upsert(rest_url, finance_headers, "payment_reversals", payment_reversals)

    print("Seeded finance data:")
    print(f"  departments:   {len(departments)}")
    print(f"  vendors:       {len(vendors)}")
    print(f"  cards:         {len(cards)}")
    print(f"  transactions:  {len(transactions)}")
    print(f"  reimbursements:{len(reimbursements)}")
    print(f"  bills:         {len(bills)}")
    print(f"  bill_payments: {len(bill_payments)}")
    print(f"  bill_adjustments: {len(bill_adjustments)}")
    print(f"  payment_reversals: {len(payment_reversals)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)
