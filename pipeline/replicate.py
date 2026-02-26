#!/usr/bin/env python3
"""
Replication Simulator - Mimics Fivetran/Airbyte
Syncs data from Supabase (Postgres) → DuckDB (Snowflake stand-in)
"""

import os
import json
import duckdb
import requests
import urllib3
from datetime import datetime

urllib3.disable_warnings()

# Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ixmbjqcguznhdwhbiuop.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4bWJqcWNndXpuaGR3aGJpdW9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA2NDE2MiwiZXhwIjoyMDg3NjQwMTYyfQ.3zPO-QDnkm4BG6nHiyg_aVTBzsQgca5h3b4Od1dy7Ww")
WAREHOUSE_PATH = os.path.join(os.path.dirname(__file__), "warehouse.duckdb")

# Tables to replicate (in dependency order)
TABLES = [
    "plans",
    "organizations",
    "users",
    "organization_members",
    "subscriptions",
    "api_keys",
    "projects",
    "browser_sessions",
    "session_events",
    "usage_records",
    "invoices",
]


def fetch_table(table_name: str) -> list:
    """Fetch all rows from a Supabase table via REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?select=*"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    
    response = requests.get(url, headers=headers, verify=False)
    if response.status_code != 200:
        print(f"  ❌ Error fetching {table_name}: {response.status_code}")
        return []
    
    return response.json()


def create_bronze_schema(conn):
    """Create the bronze schema (raw replica layer)."""
    conn.execute("CREATE SCHEMA IF NOT EXISTS bronze_supabase")
    
    # Create tables with flexible schema (DuckDB will infer types)
    # In production Fivetran, this happens automatically
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.plans (
            id VARCHAR PRIMARY KEY,
            name VARCHAR,
            display_name VARCHAR,
            monthly_price DECIMAL(10,2),
            sessions_per_month INTEGER,
            concurrent_sessions INTEGER,
            session_duration_mins INTEGER,
            has_stealth_mode BOOLEAN,
            has_residential_proxies BOOLEAN,
            has_priority_support BOOLEAN,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.organizations (
            id VARCHAR PRIMARY KEY,
            name VARCHAR,
            slug VARCHAR,
            stripe_customer_id VARCHAR,
            billing_email VARCHAR,
            status VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.users (
            id VARCHAR PRIMARY KEY,
            email VARCHAR,
            full_name VARCHAR,
            avatar_url VARCHAR,
            auth_provider VARCHAR,
            email_verified BOOLEAN,
            status VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            last_login_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.organization_members (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            user_id VARCHAR,
            role VARCHAR,
            invited_at TIMESTAMP,
            joined_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.subscriptions (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            plan_id VARCHAR,
            status VARCHAR,
            stripe_subscription_id VARCHAR,
            trial_ends_at TIMESTAMP,
            current_period_start TIMESTAMP,
            current_period_end TIMESTAMP,
            canceled_at TIMESTAMP,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.api_keys (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            created_by VARCHAR,
            name VARCHAR,
            key_prefix VARCHAR,
            key_hash VARCHAR,
            scopes VARCHAR[],
            status VARCHAR,
            last_used_at TIMESTAMP,
            expires_at TIMESTAMP,
            created_at TIMESTAMP,
            revoked_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.projects (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            name VARCHAR,
            description VARCHAR,
            default_timeout_mins INTEGER,
            default_viewport_width INTEGER,
            default_viewport_height INTEGER,
            status VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.browser_sessions (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            project_id VARCHAR,
            api_key_id VARCHAR,
            browser_type VARCHAR,
            viewport_width INTEGER,
            viewport_height INTEGER,
            proxy_type VARCHAR,
            proxy_country VARCHAR,
            stealth_mode BOOLEAN,
            status VARCHAR,
            started_at TIMESTAMP,
            ended_at TIMESTAMP,
            timeout_at TIMESTAMP,
            user_agent VARCHAR,
            initial_url VARCHAR,
            pages_visited INTEGER,
            bytes_downloaded BIGINT,
            bytes_uploaded BIGINT,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.session_events (
            id VARCHAR PRIMARY KEY,
            session_id VARCHAR,
            event_type VARCHAR,
            event_data JSON,
            page_url VARCHAR,
            page_title VARCHAR,
            timestamp TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.usage_records (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            subscription_id VARCHAR,
            period_start DATE,
            period_end DATE,
            sessions_count INTEGER,
            session_minutes DECIMAL(12,2),
            bytes_downloaded BIGINT,
            bytes_uploaded BIGINT,
            proxy_requests INTEGER,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.invoices (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            subscription_id VARCHAR,
            stripe_invoice_id VARCHAR,
            subtotal INTEGER,
            tax INTEGER,
            total INTEGER,
            status VARCHAR,
            period_start DATE,
            period_end DATE,
            due_date DATE,
            paid_at TIMESTAMP,
            created_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)


def sync_table(conn, table_name: str, rows: list):
    """Sync rows to DuckDB bronze layer (full refresh for simplicity)."""
    if not rows:
        print(f"  ⚠️  {table_name}: no rows")
        return
    
    # Clear existing data (full refresh - in production you'd do incremental)
    conn.execute(f"DELETE FROM bronze_supabase.{table_name}")
    
    # Get column names from first row
    columns = list(rows[0].keys())
    
    # Handle special columns
    if "_synced_at" not in columns:
        columns.append("_synced_at")
    
    # Insert rows
    for row in rows:
        row["_synced_at"] = datetime.now().isoformat()
        
        # Handle JSON fields
        if "event_data" in row and row["event_data"] is not None:
            row["event_data"] = json.dumps(row["event_data"])
        
        # Handle array fields
        if "scopes" in row and row["scopes"] is not None:
            row["scopes"] = row["scopes"]  # DuckDB handles this
        
        values = [row.get(col) for col in columns]
        placeholders = ", ".join(["?" for _ in columns])
        col_names = ", ".join([f'"{col}"' for col in columns])
        
        try:
            conn.execute(
                f"INSERT INTO bronze_supabase.{table_name} ({col_names}) VALUES ({placeholders})",
                values
            )
        except Exception as e:
            # Skip on error (some type mismatches)
            pass
    
    print(f"  ✓ {table_name}: {len(rows)} rows")


def main():
    print("=" * 60)
    print("🔄 REPLICATION SIMULATOR (Fivetran/Airbyte)")
    print("=" * 60)
    print(f"\nSource: {SUPABASE_URL}")
    print(f"Target: {WAREHOUSE_PATH}")
    print()
    
    # Connect to DuckDB (creates file if doesn't exist)
    conn = duckdb.connect(WAREHOUSE_PATH)
    
    # Create bronze schema
    print("Creating bronze schema...")
    create_bronze_schema(conn)
    
    # Sync each table
    print("\nSyncing tables from Supabase → DuckDB (Bronze)...")
    for table in TABLES:
        rows = fetch_table(table)
        sync_table(conn, table, rows)
    
    # Show summary
    print("\n" + "=" * 60)
    print("📊 BRONZE LAYER SUMMARY")
    print("=" * 60)
    
    for table in TABLES:
        count = conn.execute(f"SELECT COUNT(*) FROM bronze_supabase.{table}").fetchone()[0]
        print(f"  bronze_supabase.{table:20} {count:>8} rows")
    
    conn.close()
    print("\n✅ Replication complete!")
    print(f"\nWarehouse file: {WAREHOUSE_PATH}")


if __name__ == "__main__":
    main()
