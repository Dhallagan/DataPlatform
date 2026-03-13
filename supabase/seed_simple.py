#!/usr/bin/env python3
"""
Simple Supabase Seeder - Uses requests directly (bypasses SSL issues)
"""

import os
import sys
import json
import requests
import urllib3

# Disable SSL warnings for this script
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from seed_data import DataGenerator


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
        sys.exit(1)
    
    # REST API endpoint
    rest_url = f"{url}/rest/v1"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    print("Generating sample data...")
    gen = DataGenerator()
    gen.generate_all()
    
    print(f"\nGenerated:")
    print(f"  - {len(gen.plans)} plans")
    print(f"  - {len(gen.plan_economics)} plan economics rows")
    print(f"  - {len(gen.organizations)} organizations")
    print(f"  - {len(gen.users)} users")
    print(f"  - {len(gen.sessions)} sessions")
    
    print("\n" + "=" * 60)
    print("INSERTING DATA...")
    print("=" * 60)
    
    def insert(table, data, batch_size=500):
        for i in range(0, len(data), batch_size):
            batch = data[i:i+batch_size]
            resp = requests.post(
                f"{rest_url}/{table}",
                headers=headers,
                json=batch,
                verify=False  # Bypass SSL verification
            )
            if resp.status_code not in [200, 201]:
                print(f"    ❌ Error inserting into {table}: {resp.status_code}")
                print(f"    {resp.text[:500]}")
                return False
            print(f"    ✓ {min(i+batch_size, len(data))}/{len(data)}")
        return True
    
    # 1. Plans
    print("\n[1/11] Inserting plans...")
    plans_data = [{
        "id": p["id"],
        "name": p["name"],
        "display_name": p["display_name"],
        "monthly_price": float(p["monthly_price"]),
        "sessions_per_month": p["sessions_per_month"],
        "concurrent_sessions": p["concurrent_sessions"],
        "session_duration_mins": p["session_duration_mins"],
        "has_stealth_mode": p["has_stealth_mode"],
        "has_residential_proxies": p["has_residential_proxies"],
        "has_priority_support": p["has_priority_support"],
    } for p in gen.plans]
    if not insert("plans", plans_data): return

    # 2. Plan Economics
    print("\n[2/11] Inserting plan economics...")
    plan_economics_data = [{
        "id": pe["id"],
        "plan_id": pe["plan_id"],
        "expected_cost_per_hour_usd": float(pe["expected_cost_per_hour_usd"]),
        "effective_start": pe["effective_start"],
        "effective_end": pe["effective_end"],
        "notes": pe["notes"],
    } for pe in gen.plan_economics]
    if not insert("plan_economics", plan_economics_data): return
    
    # 3. Organizations
    print("\n[3/11] Inserting organizations...")
    orgs_data = [{
        "id": o["id"],
        "name": o["name"],
        "slug": o["slug"],
        "stripe_customer_id": o["stripe_customer_id"],
        "billing_email": o["billing_email"],
        "status": o["status"],
    } for o in gen.organizations]
    if not insert("organizations", orgs_data): return
    
    # 4. Users
    print("\n[4/11] Inserting users...")
    users_data = [{
        "id": u["id"],
        "email": u["email"],
        "full_name": u["full_name"],
        "avatar_url": u["avatar_url"],
        "auth_provider": u["auth_provider"],
        "email_verified": u["email_verified"],
        "status": u["status"],
    } for u in gen.users]
    if not insert("users", users_data): return
    
    # 5. Organization Members
    print("\n[5/11] Inserting organization members...")
    members_data = [{
        "id": m["id"],
        "organization_id": m["organization_id"],
        "user_id": m["user_id"],
        "role": m["role"],
    } for m in gen.org_members]
    if not insert("organization_members", members_data): return
    
    # 6. Subscriptions
    print("\n[6/11] Inserting subscriptions...")
    subs_data = [{
        "id": s["id"],
        "organization_id": s["organization_id"],
        "plan_id": s["plan_id"],
        "status": s["status"],
        "stripe_subscription_id": s["stripe_subscription_id"],
        "trial_ends_at": s["trial_ends_at"],
        "current_period_start": s["current_period_start"],
        "current_period_end": s["current_period_end"],
        "canceled_at": s["canceled_at"],
    } for s in gen.subscriptions]
    if not insert("subscriptions", subs_data): return
    
    # 7. API Keys
    print("\n[7/11] Inserting API keys...")
    keys_data = [{
        "id": k["id"],
        "organization_id": k["organization_id"],
        "created_by": k["created_by"],
        "name": k["name"],
        "key_prefix": k["key_prefix"],
        "key_hash": k["key_hash"],
        "scopes": k["scopes"],
        "status": k["status"],
        "last_used_at": k["last_used_at"],
        "expires_at": k["expires_at"],
    } for k in gen.api_keys]
    if not insert("api_keys", keys_data): return
    
    # 8. Projects
    print("\n[8/11] Inserting projects...")
    projects_data = [{
        "id": p["id"],
        "organization_id": p["organization_id"],
        "name": p["name"],
        "description": p["description"],
        "default_timeout_mins": p["default_timeout_mins"],
        "default_viewport_width": p["default_viewport_width"],
        "default_viewport_height": p["default_viewport_height"],
        "status": p["status"],
    } for p in gen.projects]
    if not insert("projects", projects_data): return
    
    # 9. Browser Sessions
    print("\n[9/11] Inserting browser sessions...")
    sessions_data = [{
        "id": s["id"],
        "organization_id": s["organization_id"],
        "project_id": s["project_id"],
        "api_key_id": s["api_key_id"],
        "browser_type": s["browser_type"],
        "viewport_width": s["viewport_width"],
        "viewport_height": s["viewport_height"],
        "proxy_type": s["proxy_type"],
        "proxy_country": s["proxy_country"],
        "stealth_mode": s["stealth_mode"],
        "status": s["status"],
        "started_at": s["started_at"],
        "ended_at": s["ended_at"],
        "timeout_at": s["timeout_at"],
        "user_agent": s["user_agent"],
        "initial_url": s["initial_url"],
        "pages_visited": s["pages_visited"],
        "bytes_downloaded": s["bytes_downloaded"],
        "bytes_uploaded": s["bytes_uploaded"],
    } for s in gen.sessions]
    if not insert("browser_sessions", sessions_data): return
    
    # 10. Session Events (limit to 10k)
    print("\n[10/11] Inserting session events (10k sample)...")
    events_data = [{
        "id": e["id"],
        "session_id": e["session_id"],
        "event_type": e["event_type"],
        "event_data": e["event_data"],
        "page_url": e["page_url"],
        "page_title": e["page_title"],
        "timestamp": e["timestamp"],
    } for e in gen.session_events[:10000]]
    if not insert("session_events", events_data): return
    
    # 11. Usage Records & Invoices
    print("\n[11/11] Inserting usage records & invoices...")
    usage_data = [{
        "id": u["id"],
        "organization_id": u["organization_id"],
        "subscription_id": u["subscription_id"],
        "period_start": u["period_start"],
        "period_end": u["period_end"],
        "sessions_count": u["sessions_count"],
        "session_minutes": float(u["session_minutes"]),
        "bytes_downloaded": u["bytes_downloaded"],
        "bytes_uploaded": u["bytes_uploaded"],
        "proxy_requests": u["proxy_requests"],
    } for u in gen.usage_records]
    if not insert("usage_records", usage_data): return
    
    invoices_data = [{
        "id": i["id"],
        "organization_id": i["organization_id"],
        "subscription_id": i["subscription_id"],
        "stripe_invoice_id": i["stripe_invoice_id"],
        "subtotal": i["subtotal"],
        "tax": i["tax"],
        "total": i["total"],
        "status": i["status"],
        "period_start": i["period_start"],
        "period_end": i["period_end"],
        "due_date": i["due_date"],
        "paid_at": i["paid_at"],
    } for i in gen.invoices]
    if not insert("invoices", invoices_data): return
    
    print("\n" + "=" * 60)
    print("✅ DONE! Data loaded into Supabase.")
    print("=" * 60)


if __name__ == "__main__":
    main()
