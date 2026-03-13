#!/usr/bin/env python3
"""
Supabase Seeder - Uploads data directly to Supabase using the API

Usage:
    1. Copy .env.example to .env and fill in your credentials
    2. pip install supabase python-dotenv
    3. python seed_supabase.py
"""

import os
import sys

# Load .env file if it exists
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed, rely on environment variables

from supabase import create_client, Client
from seed_data import DataGenerator


def main():
    # Get credentials from environment
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        print("=" * 60)
        print("SUPABASE SEEDER")
        print("=" * 60)
        print("\n❌ Missing credentials!")
        print("\nOption 1: Create a .env file")
        print("  cp .env.example .env")
        print("  # Then edit .env with your credentials")
        print("\nOption 2: Set environment variables")
        print("  export SUPABASE_URL='https://xxx.supabase.co'")
        print("  export SUPABASE_SERVICE_KEY='eyJ...'")
        print("\nFind your credentials at:")
        print("  https://supabase.com/dashboard/project/_/settings/api")
        print()
        sys.exit(1)
    
    print(f"\nConnecting to Supabase...")
    supabase: Client = create_client(url, key)
    
    # Generate data
    print("\nGenerating sample data...")
    gen = DataGenerator()
    gen.generate_all()
    
    print(f"\nGenerated:")
    print(f"  - {len(gen.plans)} plans")
    print(f"  - {len(gen.plan_economics)} plan economics rows")
    print(f"  - {len(gen.organizations)} organizations")
    print(f"  - {len(gen.users)} users")
    print(f"  - {len(gen.subscriptions)} subscriptions")
    print(f"  - {len(gen.api_keys)} API keys")
    print(f"  - {len(gen.projects)} projects")
    print(f"  - {len(gen.sessions)} browser sessions")
    print(f"  - {len(gen.session_events)} session events (will insert {min(len(gen.session_events), 10000)})")
    print(f"  - {len(gen.usage_records)} usage records")
    print(f"  - {len(gen.invoices)} invoices")
    
    # Confirm (skip if --yes flag)
    if "--yes" not in sys.argv:
        print("\n⚠️  This will INSERT data into your Supabase database.")
        print("Run with --yes to skip this prompt.")
        try:
            confirm = input("Continue? (y/N): ").strip().lower()
            if confirm != 'y':
                print("Aborted.")
                return
        except EOFError:
            print("\nNon-interactive mode detected. Use --yes flag to proceed.")
            return
    
    # Insert in order (respecting foreign keys)
    print("\n" + "=" * 60)
    print("INSERTING DATA...")
    print("=" * 60)
    
    # Plans
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
    supabase.table("plans").insert(plans_data).execute()
    print(f"    ✓ {len(plans_data)} plans")

    # Plan Economics
    print("\n[2/11] Inserting plan economics...")
    plan_economics_data = [{
        "id": pe["id"],
        "plan_id": pe["plan_id"],
        "expected_cost_per_hour_usd": float(pe["expected_cost_per_hour_usd"]),
        "effective_start": pe["effective_start"],
        "effective_end": pe["effective_end"],
        "notes": pe["notes"],
    } for pe in gen.plan_economics]
    supabase.table("plan_economics").insert(plan_economics_data).execute()
    print(f"    ✓ {len(plan_economics_data)} plan economics rows")
    
    # Organizations
    print("\n[3/11] Inserting organizations...")
    orgs_data = [{
        "id": o["id"],
        "name": o["name"],
        "slug": o["slug"],
        "stripe_customer_id": o["stripe_customer_id"],
        "billing_email": o["billing_email"],
        "status": o["status"],
    } for o in gen.organizations]
    supabase.table("organizations").insert(orgs_data).execute()
    print(f"    ✓ {len(orgs_data)} organizations")
    
    # Users
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
    supabase.table("users").insert(users_data).execute()
    print(f"    ✓ {len(users_data)} users")
    
    # Organization Members
    print("\n[5/11] Inserting organization members...")
    members_data = [{
        "id": m["id"],
        "organization_id": m["organization_id"],
        "user_id": m["user_id"],
        "role": m["role"],
    } for m in gen.org_members]
    supabase.table("organization_members").insert(members_data).execute()
    print(f"    ✓ {len(members_data)} members")
    
    # Subscriptions
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
    supabase.table("subscriptions").insert(subs_data).execute()
    print(f"    ✓ {len(subs_data)} subscriptions")
    
    # API Keys
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
    supabase.table("api_keys").insert(keys_data).execute()
    print(f"    ✓ {len(keys_data)} API keys")
    
    # Projects
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
    supabase.table("projects").insert(projects_data).execute()
    print(f"    ✓ {len(projects_data)} projects")
    
    # Browser Sessions (batch insert)
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
    
    # Batch insert (Supabase has limits)
    batch_size = 500
    for i in range(0, len(sessions_data), batch_size):
        batch = sessions_data[i:i+batch_size]
        supabase.table("browser_sessions").insert(batch).execute()
        print(f"    ✓ {min(i+batch_size, len(sessions_data))}/{len(sessions_data)} sessions")
    
    # Session Events (limit to 10k for speed)
    print("\n[10/11] Inserting session events (limited to 10k)...")
    events_data = [{
        "id": e["id"],
        "session_id": e["session_id"],
        "event_type": e["event_type"],
        "event_data": e["event_data"],
        "page_url": e["page_url"],
        "page_title": e["page_title"],
        "timestamp": e["timestamp"],
    } for e in gen.session_events[:10000]]
    
    for i in range(0, len(events_data), batch_size):
        batch = events_data[i:i+batch_size]
        supabase.table("session_events").insert(batch).execute()
        print(f"    ✓ {min(i+batch_size, len(events_data))}/{len(events_data)} events")
    
    # Usage Records
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
    supabase.table("usage_records").insert(usage_data).execute()
    print(f"    ✓ {len(usage_data)} usage records")
    
    # Invoices
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
    supabase.table("invoices").insert(invoices_data).execute()
    print(f"    ✓ {len(invoices_data)} invoices")
    
    print("\n" + "=" * 60)
    print("✅ DONE! Data loaded into Supabase.")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Go to your Supabase dashboard → Table Editor")
    print("2. Explore the data!")
    print("3. Run some queries in the SQL Editor")
    print()


if __name__ == "__main__":
    main()
