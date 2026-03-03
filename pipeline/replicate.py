#!/usr/bin/env python3
"""
Replication Simulator - Mimics Fivetran/Airbyte
Syncs data from Supabase (Postgres) → DuckDB (Snowflake stand-in)
"""

import os
import json
import duckdb
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from datetime import datetime, timezone

# Configuration
def load_dotenv_if_present():
    """Load a .env file from project root or pipeline dir into process env."""
    search_paths = [
        os.path.join(os.path.dirname(__file__), "..", ".env"),
        os.path.join(os.path.dirname(__file__), ".env"),
    ]

    for env_path in search_paths:
        env_path = os.path.abspath(env_path)
        if not os.path.exists(env_path):
            continue

        with open(env_path, "r", encoding="utf-8") as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key, value)
        break


load_dotenv_if_present()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
WAREHOUSE_PATH = os.environ.get(
    "WAREHOUSE_DUCKDB_PATH",
    os.environ.get(
        "MOTHERDUCK_PATH",
        "/tmp/browserbase_warehouse.duckdb"
    )
)
MOTHERDUCK_TOKEN = os.environ.get("MOTHERDUCK_TOKEN")
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SUPABASE_PAGE_SIZE = int(os.environ.get("SUPABASE_PAGE_SIZE", "1000"))
SUPABASE_REQUEST_TIMEOUT_SECONDS = int(os.environ.get("SUPABASE_REQUEST_TIMEOUT_SECONDS", "30"))
SUPABASE_VERIFY_TLS = os.environ.get("SUPABASE_VERIFY_TLS", "true").lower() not in {
    "0",
    "false",
    "no",
}


def create_request_session() -> requests.Session:
    """Create an HTTP session with retry policy for transient Supabase errors."""
    retry = Retry(
        total=4,
        connect=4,
        read=4,
        backoff_factor=1.0,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=frozenset({"GET"}),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session = requests.Session()
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


REQUEST_SESSION = create_request_session()

# Tables to replicate (in dependency order)
# - source_table: table name in Supabase
# - source_schema: schema in Supabase REST profile
# - bronze_table: destination table in bronze_supabase
TABLES = [
    {"source_table": "plans", "source_schema": "public", "bronze_table": "plans"},
    {"source_table": "organizations", "source_schema": "public", "bronze_table": "organizations"},
    {"source_table": "users", "source_schema": "public", "bronze_table": "users"},
    {"source_table": "organization_members", "source_schema": "public", "bronze_table": "organization_members"},
    {"source_table": "subscriptions", "source_schema": "public", "bronze_table": "subscriptions"},
    {"source_table": "api_keys", "source_schema": "public", "bronze_table": "api_keys"},
    {"source_table": "projects", "source_schema": "public", "bronze_table": "projects"},
    {"source_table": "browser_sessions", "source_schema": "public", "bronze_table": "browser_sessions"},
    {"source_table": "session_events", "source_schema": "public", "bronze_table": "session_events"},
    {"source_table": "usage_records", "source_schema": "public", "bronze_table": "usage_records"},
    {"source_table": "invoices", "source_schema": "public", "bronze_table": "invoices"},
    # GTM schema (Salesforce-like simulation)
    {"source_table": "accounts", "source_schema": "gtm", "bronze_table": "gtm_accounts"},
    {"source_table": "contacts", "source_schema": "gtm", "bronze_table": "gtm_contacts"},
    {"source_table": "leads", "source_schema": "gtm", "bronze_table": "gtm_leads"},
    {"source_table": "campaigns", "source_schema": "gtm", "bronze_table": "gtm_campaigns"},
    {"source_table": "lead_touches", "source_schema": "gtm", "bronze_table": "gtm_lead_touches"},
    {"source_table": "opportunities", "source_schema": "gtm", "bronze_table": "gtm_opportunities"},
    {"source_table": "activities", "source_schema": "gtm", "bronze_table": "gtm_activities"},
    # Finance schema (Ramp-like spend ops simulation)
    {"source_table": "departments", "source_schema": "finance", "bronze_table": "finance_departments"},
    {"source_table": "vendors", "source_schema": "finance", "bronze_table": "finance_vendors"},
    {"source_table": "cards", "source_schema": "finance", "bronze_table": "finance_cards"},
    {"source_table": "transactions", "source_schema": "finance", "bronze_table": "finance_transactions"},
    {"source_table": "reimbursements", "source_schema": "finance", "bronze_table": "finance_reimbursements"},
    {"source_table": "bills", "source_schema": "finance", "bronze_table": "finance_bills"},
    {"source_table": "bill_payments", "source_schema": "finance", "bronze_table": "finance_bill_payments"},
    {"source_table": "bill_adjustments", "source_schema": "finance", "bronze_table": "finance_bill_adjustments"},
    {"source_table": "payment_reversals", "source_schema": "finance", "bronze_table": "finance_payment_reversals"},
]


def fetch_table(table_name: str, schema_name: str = "public") -> list:
    """Fetch all rows from a Supabase table via paginated REST API calls."""
    url = f"{SUPABASE_URL}/rest/v1/{table_name}?select=*"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Accept-Profile": schema_name,
    }
    rows: list = []
    offset = 0

    while True:
        page_headers = {
            **headers,
            "Range-Unit": "items",
            "Range": f"{offset}-{offset + SUPABASE_PAGE_SIZE - 1}",
        }
        response = REQUEST_SESSION.get(
            url,
            headers=page_headers,
            timeout=SUPABASE_REQUEST_TIMEOUT_SECONDS,
            verify=SUPABASE_VERIFY_TLS,
        )
        if response.status_code not in (200, 206):
            raise RuntimeError(
                f"Supabase fetch failed for {schema_name}.{table_name} "
                f"(status={response.status_code}): {response.text[:500]}"
            )

        payload = response.json()
        if not isinstance(payload, list):
            raise RuntimeError(
                f"Unexpected payload type for {schema_name}.{table_name}: {type(payload).__name__}"
            )

        rows.extend(payload)
        if len(payload) < SUPABASE_PAGE_SIZE:
            break
        offset += SUPABASE_PAGE_SIZE

    return rows


def get_table_columns(conn, bronze_table: str) -> list[str]:
    """Return ordered destination column names for a bronze table."""
    info = conn.execute(f"PRAGMA table_info('bronze_supabase.{bronze_table}')").fetchall()
    if not info:
        raise RuntimeError(f"Destination table not found: bronze_supabase.{bronze_table}")
    return [row[1] for row in info]


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

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.gtm_accounts (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            name VARCHAR,
            website_domain VARCHAR,
            industry VARCHAR,
            employee_band VARCHAR,
            account_tier VARCHAR,
            account_status VARCHAR,
            owner_user_id VARCHAR,
            source_system VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.gtm_contacts (
            id VARCHAR PRIMARY KEY,
            account_id VARCHAR,
            email VARCHAR,
            full_name VARCHAR,
            title VARCHAR,
            department VARCHAR,
            seniority VARCHAR,
            lifecycle_stage VARCHAR,
            is_primary_contact BOOLEAN,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.gtm_leads (
            id VARCHAR PRIMARY KEY,
            account_id VARCHAR,
            contact_id VARCHAR,
            lead_source VARCHAR,
            lead_status VARCHAR,
            source_detail VARCHAR,
            score INTEGER,
            owner_user_id VARCHAR,
            first_touch_at TIMESTAMP,
            converted_at TIMESTAMP,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.gtm_campaigns (
            id VARCHAR PRIMARY KEY,
            name VARCHAR,
            channel VARCHAR,
            objective VARCHAR,
            status VARCHAR,
            budget_usd DECIMAL(12,2),
            start_date DATE,
            end_date DATE,
            owner_user_id VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.gtm_lead_touches (
            id VARCHAR PRIMARY KEY,
            lead_id VARCHAR,
            campaign_id VARCHAR,
            touch_type VARCHAR,
            touch_at TIMESTAMP,
            channel VARCHAR,
            metadata JSON,
            created_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.gtm_opportunities (
            id VARCHAR PRIMARY KEY,
            account_id VARCHAR,
            primary_contact_id VARCHAR,
            originating_lead_id VARCHAR,
            opportunity_name VARCHAR,
            stage VARCHAR,
            amount_usd DECIMAL(12,2),
            forecast_category VARCHAR,
            expected_close_date DATE,
            closed_at TIMESTAMP,
            is_won BOOLEAN,
            loss_reason VARCHAR,
            owner_user_id VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.gtm_activities (
            id VARCHAR PRIMARY KEY,
            account_id VARCHAR,
            contact_id VARCHAR,
            lead_id VARCHAR,
            opportunity_id VARCHAR,
            activity_type VARCHAR,
            direction VARCHAR,
            subject VARCHAR,
            outcome VARCHAR,
            occurred_at TIMESTAMP,
            owner_user_id VARCHAR,
            created_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.finance_departments (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            name VARCHAR,
            cost_center VARCHAR,
            budget_usd DECIMAL(12,2),
            owner_user_id VARCHAR,
            status VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.finance_vendors (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            vendor_name VARCHAR,
            category VARCHAR,
            status VARCHAR,
            payment_terms VARCHAR,
            risk_level VARCHAR,
            country VARCHAR,
            currency VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.finance_cards (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            card_last4 VARCHAR,
            card_brand VARCHAR,
            card_type VARCHAR,
            cardholder_user_id VARCHAR,
            department_id VARCHAR,
            vendor_id VARCHAR,
            spend_limit_usd DECIMAL(12,2),
            status VARCHAR,
            issued_at TIMESTAMP,
            frozen_at TIMESTAMP,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.finance_transactions (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            card_id VARCHAR,
            vendor_id VARCHAR,
            department_id VARCHAR,
            merchant_name VARCHAR,
            merchant_category VARCHAR,
            amount_usd DECIMAL(12,2),
            currency VARCHAR,
            transaction_type VARCHAR,
            status VARCHAR,
            transaction_at TIMESTAMP,
            settled_at TIMESTAMP,
            memo VARCHAR,
            receipt_url VARCHAR,
            created_by_user_id VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.finance_reimbursements (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            submitted_by_user_id VARCHAR,
            department_id VARCHAR,
            vendor_id VARCHAR,
            amount_usd DECIMAL(12,2),
            currency VARCHAR,
            status VARCHAR,
            expense_date DATE,
            submitted_at TIMESTAMP,
            approved_at TIMESTAMP,
            paid_at TIMESTAMP,
            memo VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.finance_bills (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            vendor_id VARCHAR,
            department_id VARCHAR,
            bill_number VARCHAR,
            bill_date DATE,
            due_date DATE,
            amount_usd DECIMAL(12,2),
            currency VARCHAR,
            status VARCHAR,
            approved_by_user_id VARCHAR,
            memo VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.finance_bill_payments (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            bill_id VARCHAR,
            payment_method VARCHAR,
            amount_usd DECIMAL(12,2),
            currency VARCHAR,
            paid_at TIMESTAMP,
            status VARCHAR,
            external_payment_id VARCHAR,
            created_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.finance_bill_adjustments (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            bill_id VARCHAR,
            adjustment_type VARCHAR,
            direction VARCHAR,
            amount_usd DECIMAL(12,2),
            currency VARCHAR,
            reason VARCHAR,
            adjusted_at TIMESTAMP,
            created_by_user_id VARCHAR,
            created_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS bronze_supabase.finance_payment_reversals (
            id VARCHAR PRIMARY KEY,
            organization_id VARCHAR,
            original_payment_id VARCHAR,
            bill_id VARCHAR,
            reversal_amount_usd DECIMAL(12,2),
            currency VARCHAR,
            status VARCHAR,
            reversal_reason VARCHAR,
            reversed_at TIMESTAMP,
            created_by_user_id VARCHAR,
            created_at TIMESTAMP,
            _synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)


def sync_table(conn, bronze_table: str, rows: list):
    """Sync rows into DuckDB bronze with all-or-nothing replacement semantics."""
    dest_columns = get_table_columns(conn, bronze_table)
    writable_columns = [col for col in dest_columns if col != "_synced_at"]
    source_columns = [col for col in writable_columns if any(col in row for row in rows)]
    load_columns = [*source_columns, "_synced_at"]
    placeholders = ", ".join(["?" for _ in load_columns])
    col_names = ", ".join([f'"{col}"' for col in load_columns])

    staged_rows = []
    synced_at = datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)
    for row in rows:
        prepared = {}
        for col in source_columns:
            value = row.get(col)
            if col != "scopes" and isinstance(value, (dict, list)):
                value = json.dumps(value)
            prepared[col] = value
        prepared["_synced_at"] = synced_at
        staged_rows.append(tuple(prepared.get(col) for col in load_columns))

    temp_table = f"temp_sync_{bronze_table}"
    conn.execute(f"DROP TABLE IF EXISTS {temp_table}")
    conn.execute(
        f"""
        CREATE TEMP TABLE {temp_table}
        AS SELECT * FROM bronze_supabase.{bronze_table} WHERE 1 = 0
        """
    )
    if staged_rows:
        conn.executemany(
            f"INSERT INTO {temp_table} ({col_names}) VALUES ({placeholders})",
            staged_rows,
        )

    conn.execute("BEGIN")
    try:
        conn.execute(f"DELETE FROM bronze_supabase.{bronze_table}")
        conn.execute(f"INSERT INTO bronze_supabase.{bronze_table} SELECT * FROM {temp_table}")
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise

    print(f"  ✓ {bronze_table}: {len(rows)} rows")


def connect_warehouse():
    """Connect to local DuckDB file or MotherDuck based on WAREHOUSE_DUCKDB_PATH."""
    resolved_path = WAREHOUSE_PATH
    if not resolved_path.startswith("md:") and not os.path.isabs(resolved_path):
        resolved_path = os.path.abspath(os.path.join(PROJECT_ROOT, resolved_path))

    connection_kwargs = {}
    if resolved_path.startswith("md:"):
        if not MOTHERDUCK_TOKEN:
            raise ValueError(
                "WAREHOUSE_DUCKDB_PATH is an md: path but MOTHERDUCK_TOKEN is missing."
            )
        connection_kwargs["config"] = {"motherduck_token": MOTHERDUCK_TOKEN}

    return duckdb.connect(resolved_path, **connection_kwargs)


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "Missing required environment variables: SUPABASE_URL and/or "
            "SUPABASE_SERVICE_KEY. Add them to .env or export them in your shell."
        )

    print("=" * 60)
    print("🔄 REPLICATION SIMULATOR (Fivetran/Airbyte)")
    print("=" * 60)
    print(f"\nSource: {SUPABASE_URL}")
    print(f"Target: {WAREHOUSE_PATH}")
    print()
    
    # Connect to local DuckDB or MotherDuck
    conn = connect_warehouse()
    try:
        # Create bronze schema
        print("Creating bronze schema...")
        create_bronze_schema(conn)

        # Sync each table
        print("\nSyncing tables from Supabase → DuckDB (Bronze)...")
        for table_cfg in TABLES:
            source_table = table_cfg["source_table"]
            source_schema = table_cfg["source_schema"]
            bronze_table = table_cfg["bronze_table"]
            print(f"  → Fetching {source_schema}.{source_table} ...")
            rows = fetch_table(source_table, source_schema)
            sync_table(conn, bronze_table, rows)

        # Show summary
        print("\n" + "=" * 60)
        print("📊 BRONZE LAYER SUMMARY")
        print("=" * 60)

        for table_cfg in TABLES:
            bronze_table = table_cfg["bronze_table"]
            count = conn.execute(f"SELECT COUNT(*) FROM bronze_supabase.{bronze_table}").fetchone()[0]
            print(f"  bronze_supabase.{bronze_table:20} {count:>8} rows")
    finally:
        conn.close()

    print("\n✅ Replication complete!")
    print(f"\nWarehouse file: {WAREHOUSE_PATH}")


if __name__ == "__main__":
    main()
