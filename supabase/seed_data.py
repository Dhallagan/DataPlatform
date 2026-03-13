#!/usr/bin/env python3
"""
Seed Data Generator for Browserbase-like Database
Generates realistic sample data for the browser infrastructure platform.
"""

import uuid
import random
import hashlib
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
NUM_ORGANIZATIONS = 50
USERS_PER_ORG = (1, 8)
PROJECTS_PER_ORG = (1, 5)
SESSIONS_PER_ORG = (10, 500)
EVENTS_PER_SESSION = (3, 50)
SEED = 42

random.seed(SEED)

# Start date for data generation (6 months back)
START_DATE = datetime.now() - timedelta(days=180)
END_DATE = datetime.now()

# -----------------------------------------------------------------------------
# Sample Data Pools
# -----------------------------------------------------------------------------
FIRST_NAMES = [
    "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Avery",
    "Reese", "Drew", "Skyler", "Charlie", "Sam", "Jamie", "Parker", "Blake",
    "Cameron", "Hayden", "Sage", "River", "Phoenix", "Dakota", "Rowan", "Finley"
]

LAST_NAMES = [
    "Chen", "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
    "Davis", "Rodriguez", "Martinez", "Anderson", "Taylor", "Thomas", "Moore",
    "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez"
]

COMPANY_PREFIXES = [
    "Tech", "Data", "Cloud", "Web", "Auto", "Smart", "Rapid", "Pixel", "Logic",
    "Code", "Byte", "Stack", "Flow", "Pulse", "Link", "Core", "Net", "Sync"
]

COMPANY_SUFFIXES = [
    "Labs", "Systems", "Solutions", "Analytics", "AI", "IO", "Hub", "Works",
    "Forge", "Studio", "Technologies", "Software", "Digital", "Ventures"
]

DOMAINS = ["com", "io", "co", "dev", "tech", "ai"]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15"
]

SAMPLE_URLS = [
    "https://www.google.com", "https://www.amazon.com", "https://www.github.com",
    "https://www.linkedin.com", "https://www.twitter.com", "https://news.ycombinator.com",
    "https://www.reddit.com", "https://www.ebay.com", "https://www.walmart.com",
    "https://www.target.com", "https://www.zillow.com", "https://www.indeed.com",
    "https://www.yelp.com", "https://www.tripadvisor.com", "https://www.booking.com"
]

PROJECT_NAMES = [
    "Price Monitoring", "Lead Generation", "Content Scraping", "SEO Analysis",
    "Competitor Research", "E2E Testing", "Screenshot Service", "PDF Generation",
    "Data Extraction", "Market Research", "Social Listening", "Review Aggregation"
]

EVENT_TYPES = ["navigation", "click", "input", "screenshot", "scroll", "wait", "error", "console"]

COUNTRIES = ["US", "GB", "DE", "FR", "JP", "AU", "CA", "BR", "IN", "SG"]

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
def gen_uuid() -> str:
    return str(uuid.uuid4())

def random_date(start: datetime, end: datetime) -> datetime:
    delta = end - start
    if delta.days <= 0:
        return start
    random_days = random.randint(0, delta.days)
    random_seconds = random.randint(0, 86400)
    return start + timedelta(days=random_days, seconds=random_seconds)

def sql_timestamp(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")

def sql_date(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")

def slugify(name: str) -> str:
    return name.lower().replace(" ", "-").replace(".", "")

def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

def gen_api_key() -> tuple:
    key = f"bb_live_{''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=32))}"
    return key[:8], hash_key(key)

def escape_sql(s: str) -> str:
    if s is None:
        return "NULL"
    return "'" + s.replace("'", "''") + "'"

def sql_array(items: List[str]) -> str:
    if not items:
        return "ARRAY[]::TEXT[]"
    escaped = [f"'{item}'" for item in items]
    return f"ARRAY[{', '.join(escaped)}]"

def sql_jsonb(data: Dict) -> str:
    return f"'{json.dumps(data)}'::JSONB"

# -----------------------------------------------------------------------------
# Data Generation
# -----------------------------------------------------------------------------
class DataGenerator:
    def __init__(self):
        self.plans = []
        self.plan_economics = []
        self.organizations = []
        self.users = []
        self.org_members = []
        self.subscriptions = []
        self.api_keys = []
        self.projects = []
        self.sessions = []
        self.session_events = []
        self.usage_records = []
        self.invoices = []
        
    def generate_plans(self):
        """Generate pricing plans."""
        plans_data = [
            ("free", "Free", 0, 100, 2, 5, False, False, False),
            ("starter", "Starter", 49, 1000, 5, 30, True, False, False),
            ("pro", "Pro", 199, 10000, 20, 60, True, True, False),
            ("enterprise", "Enterprise", 999, None, 100, 120, True, True, True),
        ]
        
        for name, display, price, sessions, concurrent, duration, stealth, proxy, support in plans_data:
            plan = {
                "id": gen_uuid(),
                "name": name,
                "display_name": display,
                "monthly_price": price,
                "sessions_per_month": sessions,
                "concurrent_sessions": concurrent,
                "session_duration_mins": duration,
                "has_stealth_mode": stealth,
                "has_residential_proxies": proxy,
                "has_priority_support": support,
                "created_at": sql_timestamp(START_DATE),
            }
            self.plans.append(plan)

    def generate_plan_economics(self):
        """Generate baseline plan economics assumptions."""
        expected_hourly_costs = {
            "free": 0.60,
            "starter": 0.95,
            "pro": 1.45,
            "enterprise": 2.10,
        }

        for plan in self.plans:
            economics = {
                "id": gen_uuid(),
                "plan_id": plan["id"],
                "expected_cost_per_hour_usd": expected_hourly_costs.get(plan["name"], 1.00),
                "effective_start": sql_timestamp(START_DATE),
                "effective_end": None,
                "notes": f"Seed baseline economics for {plan['name']} plan",
                "created_at": sql_timestamp(START_DATE),
            }
            self.plan_economics.append(economics)
    
    def generate_organizations(self):
        """Generate organizations."""
        for i in range(NUM_ORGANIZATIONS):
            name = f"{random.choice(COMPANY_PREFIXES)}{random.choice(COMPANY_SUFFIXES)}"
            domain = random.choice(DOMAINS)
            created = random_date(START_DATE, END_DATE - timedelta(days=30))
            
            # Weighted status (most are active)
            status = random.choices(
                ["active", "suspended", "churned"],
                weights=[85, 5, 10]
            )[0]
            
            org = {
                "id": gen_uuid(),
                "name": name,
                "slug": slugify(name) + f"-{i}",
                "stripe_customer_id": f"cus_{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=14))}",
                "billing_email": f"billing@{slugify(name)}.{domain}",
                "status": status,
                "created_at": sql_timestamp(created),
            }
            self.organizations.append(org)
    
    def generate_users(self):
        """Generate users and organization memberships."""
        for org in self.organizations:
            num_users = random.randint(*USERS_PER_ORG)
            org_created = datetime.strptime(org["created_at"], "%Y-%m-%d %H:%M:%S")
            
            for j in range(num_users):
                first = random.choice(FIRST_NAMES)
                last = random.choice(LAST_NAMES)
                domain = org["billing_email"].split("@")[1]
                
                user_created = random_date(org_created, min(org_created + timedelta(days=60), END_DATE))
                last_login = random_date(user_created, END_DATE) if random.random() > 0.1 else None
                
                # Make email unique using full org slug and user index
                user = {
                    "id": gen_uuid(),
                    "email": f"{first.lower()}{j}@{org['slug']}.{domain}",
                    "full_name": f"{first} {last}",
                    "avatar_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed={first}{last}",
                    "auth_provider": random.choice(["email", "github", "google"]),
                    "email_verified": random.random() > 0.1,
                    "status": "active" if org["status"] == "active" else org["status"],
                    "created_at": sql_timestamp(user_created),
                    "last_login_at": sql_timestamp(last_login) if last_login else None,
                }
                self.users.append(user)
                
                # Create membership
                role = "owner" if j == 0 else random.choice(["admin", "member", "member", "member"])
                member = {
                    "id": gen_uuid(),
                    "organization_id": org["id"],
                    "user_id": user["id"],
                    "role": role,
                    "invited_at": sql_timestamp(user_created),
                    "joined_at": sql_timestamp(user_created),
                }
                self.org_members.append(member)
    
    def generate_subscriptions(self):
        """Generate subscriptions for organizations."""
        for org in self.organizations:
            org_created = datetime.strptime(org["created_at"], "%Y-%m-%d %H:%M:%S")
            
            # Weight toward lower plans
            plan = random.choices(
                self.plans,
                weights=[40, 35, 20, 5]
            )[0]
            
            status = "active" if org["status"] == "active" else "canceled"
            period_start = random_date(org_created, END_DATE - timedelta(days=30))
            period_end = period_start + timedelta(days=30)
            
            sub = {
                "id": gen_uuid(),
                "organization_id": org["id"],
                "plan_id": plan["id"],
                "status": status,
                "stripe_subscription_id": f"sub_{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=14))}",
                "trial_ends_at": sql_timestamp(org_created + timedelta(days=14)) if plan["name"] != "free" else None,
                "current_period_start": sql_timestamp(period_start),
                "current_period_end": sql_timestamp(period_end),
                "canceled_at": sql_timestamp(random_date(period_start, END_DATE)) if status == "canceled" else None,
                "created_at": sql_timestamp(org_created),
            }
            self.subscriptions.append(sub)
    
    def generate_api_keys(self):
        """Generate API keys for organizations."""
        for org in self.organizations:
            # Find owner user
            owner = next((m for m in self.org_members if m["organization_id"] == org["id"] and m["role"] == "owner"), None)
            
            num_keys = random.randint(1, 3)
            for k in range(num_keys):
                prefix, key_hash = gen_api_key()
                created = datetime.strptime(org["created_at"], "%Y-%m-%d %H:%M:%S")
                key_created = random_date(created, END_DATE)
                
                api_key = {
                    "id": gen_uuid(),
                    "organization_id": org["id"],
                    "created_by": owner["user_id"] if owner else None,
                    "name": f"{'Production' if k == 0 else 'Development'} Key {k + 1}",
                    "key_prefix": prefix,
                    "key_hash": key_hash,
                    "scopes": ["sessions:read", "sessions:write"] if k == 0 else ["sessions:read"],
                    "status": "active" if random.random() > 0.1 else "revoked",
                    "last_used_at": sql_timestamp(random_date(key_created, END_DATE)) if random.random() > 0.2 else None,
                    "expires_at": None,
                    "created_at": sql_timestamp(key_created),
                }
                self.api_keys.append(api_key)
    
    def generate_projects(self):
        """Generate projects for organizations."""
        for org in self.organizations:
            num_projects = random.randint(*PROJECTS_PER_ORG)
            org_created = datetime.strptime(org["created_at"], "%Y-%m-%d %H:%M:%S")
            
            used_names = set()
            for _ in range(num_projects):
                name = random.choice(PROJECT_NAMES)
                while name in used_names:
                    name = random.choice(PROJECT_NAMES)
                used_names.add(name)
                
                project = {
                    "id": gen_uuid(),
                    "organization_id": org["id"],
                    "name": name,
                    "description": f"Automated browser sessions for {name.lower()}",
                    "default_timeout_mins": random.choice([15, 30, 60]),
                    "default_viewport_width": random.choice([1280, 1920, 2560]),
                    "default_viewport_height": random.choice([720, 1080, 1440]),
                    "status": "active" if random.random() > 0.1 else "archived",
                    "created_at": sql_timestamp(random_date(org_created, END_DATE)),
                }
                self.projects.append(project)
    
    def generate_sessions(self):
        """Generate browser sessions."""
        for org in self.organizations:
            org_projects = [p for p in self.projects if p["organization_id"] == org["id"]]
            org_keys = [k for k in self.api_keys if k["organization_id"] == org["id"] and k["status"] == "active"]
            
            if not org_keys:
                continue
            
            # More sessions for active orgs
            num_sessions = random.randint(*SESSIONS_PER_ORG)
            if org["status"] != "active":
                num_sessions = num_sessions // 3
            
            org_created = datetime.strptime(org["created_at"], "%Y-%m-%d %H:%M:%S")
            
            for _ in range(num_sessions):
                project = random.choice(org_projects) if org_projects else None
                api_key = random.choice(org_keys)
                
                created = random_date(org_created, END_DATE)
                started = created + timedelta(seconds=random.randint(1, 10))
                
                # Session duration based on status
                status = random.choices(
                    ["completed", "failed", "timeout", "running"],
                    weights=[75, 10, 10, 5]
                )[0]
                
                if status == "completed":
                    duration_mins = random.randint(1, 45)
                    ended = started + timedelta(minutes=duration_mins)
                elif status in ["failed", "timeout"]:
                    duration_mins = random.randint(1, 15)
                    ended = started + timedelta(minutes=duration_mins)
                else:
                    ended = None
                
                session = {
                    "id": gen_uuid(),
                    "organization_id": org["id"],
                    "project_id": project["id"] if project else None,
                    "api_key_id": api_key["id"],
                    "browser_type": random.choice(["chromium", "chromium", "chromium", "firefox", "webkit"]),
                    "viewport_width": project["default_viewport_width"] if project else 1920,
                    "viewport_height": project["default_viewport_height"] if project else 1080,
                    "proxy_type": random.choice([None, None, "datacenter", "residential"]),
                    "proxy_country": random.choice(COUNTRIES) if random.random() > 0.5 else None,
                    "stealth_mode": random.random() > 0.7,
                    "status": status,
                    "started_at": sql_timestamp(started),
                    "ended_at": sql_timestamp(ended) if ended else None,
                    "timeout_at": sql_timestamp(started + timedelta(minutes=30)),
                    "user_agent": random.choice(USER_AGENTS),
                    "initial_url": random.choice(SAMPLE_URLS),
                    "pages_visited": random.randint(1, 50) if status == "completed" else random.randint(0, 10),
                    "bytes_downloaded": random.randint(100000, 50000000) if status == "completed" else random.randint(0, 1000000),
                    "bytes_uploaded": random.randint(1000, 500000) if status == "completed" else random.randint(0, 10000),
                    "created_at": sql_timestamp(created),
                }
                self.sessions.append(session)
    
    def generate_session_events(self):
        """Generate events for sessions."""
        for session in self.sessions:
            if session["status"] == "running":
                continue
                
            num_events = random.randint(*EVENTS_PER_SESSION)
            session_start = datetime.strptime(session["started_at"], "%Y-%m-%d %H:%M:%S")
            session_end = datetime.strptime(session["ended_at"], "%Y-%m-%d %H:%M:%S") if session["ended_at"] else session_start + timedelta(minutes=5)
            
            current_url = session["initial_url"]
            
            for i in range(num_events):
                event_time = session_start + timedelta(
                    seconds=int((session_end - session_start).total_seconds() * (i / num_events))
                )
                
                event_type = random.choices(
                    EVENT_TYPES,
                    weights=[30, 25, 15, 10, 10, 5, 3, 2]
                )[0]
                
                # Generate event-specific data
                if event_type == "navigation":
                    current_url = random.choice(SAMPLE_URLS)
                    event_data = {"url": current_url, "status": 200}
                elif event_type == "click":
                    event_data = {"selector": f"button.cta-{random.randint(1,5)}", "x": random.randint(0, 1920), "y": random.randint(0, 1080)}
                elif event_type == "input":
                    event_data = {"selector": "input[type='text']", "value": "***"}
                elif event_type == "screenshot":
                    event_data = {"format": "png", "size_bytes": random.randint(50000, 500000)}
                elif event_type == "error":
                    event_data = {"message": random.choice(["Element not found", "Timeout waiting for selector", "Navigation failed"]), "code": random.choice(["ERR_ELEMENT", "ERR_TIMEOUT", "ERR_NAV"])}
                elif event_type == "console":
                    event_data = {"level": random.choice(["log", "warn", "error"]), "message": "Console message"}
                else:
                    event_data = {}
                
                event = {
                    "id": gen_uuid(),
                    "session_id": session["id"],
                    "event_type": event_type,
                    "event_data": event_data,
                    "page_url": current_url,
                    "page_title": f"Page at {current_url.split('/')[2]}",
                    "timestamp": sql_timestamp(event_time),
                }
                self.session_events.append(event)
    
    def generate_usage_and_invoices(self):
        """Generate usage records and invoices."""
        for org in self.organizations:
            org_created = datetime.strptime(org["created_at"], "%Y-%m-%d %H:%M:%S")
            sub = next((s for s in self.subscriptions if s["organization_id"] == org["id"]), None)
            plan = next((p for p in self.plans if p["id"] == sub["plan_id"]), None) if sub else None
            
            # Generate monthly usage/invoices
            current = org_created.replace(day=1)
            while current < END_DATE:
                period_end = (current + timedelta(days=32)).replace(day=1) - timedelta(days=1)
                
                # Count sessions in this period
                org_sessions = [s for s in self.sessions if s["organization_id"] == org["id"]]
                period_sessions = [
                    s for s in org_sessions 
                    if datetime.strptime(s["created_at"], "%Y-%m-%d %H:%M:%S") >= current
                    and datetime.strptime(s["created_at"], "%Y-%m-%d %H:%M:%S") <= period_end
                ]
                
                usage = {
                    "id": gen_uuid(),
                    "organization_id": org["id"],
                    "subscription_id": sub["id"] if sub else None,
                    "period_start": sql_date(current),
                    "period_end": sql_date(period_end),
                    "sessions_count": len(period_sessions),
                    "session_minutes": sum(random.randint(5, 30) for _ in period_sessions),
                    "bytes_downloaded": sum(s["bytes_downloaded"] for s in period_sessions),
                    "bytes_uploaded": sum(s["bytes_uploaded"] for s in period_sessions),
                    "proxy_requests": sum(1 for s in period_sessions if s["proxy_type"]),
                    "created_at": sql_timestamp(period_end + timedelta(days=1)),
                }
                self.usage_records.append(usage)
                
                # Generate invoice (skip free plan)
                if plan and plan["monthly_price"] > 0:
                    subtotal = int(plan["monthly_price"] * 100)  # cents
                    tax = int(subtotal * 0.1)
                    
                    invoice = {
                        "id": gen_uuid(),
                        "organization_id": org["id"],
                        "subscription_id": sub["id"],
                        "stripe_invoice_id": f"in_{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=14))}",
                        "subtotal": subtotal,
                        "tax": tax,
                        "total": subtotal + tax,
                        "status": random.choices(["paid", "paid", "paid", "open", "void"], weights=[80, 10, 5, 3, 2])[0],
                        "period_start": sql_date(current),
                        "period_end": sql_date(period_end),
                        "due_date": sql_date(period_end + timedelta(days=15)),
                        "paid_at": sql_timestamp(period_end + timedelta(days=random.randint(1, 10))) if random.random() > 0.1 else None,
                        "created_at": sql_timestamp(period_end + timedelta(days=1)),
                    }
                    self.invoices.append(invoice)
                
                current = (current + timedelta(days=32)).replace(day=1)
    
    def generate_all(self):
        """Generate all data."""
        print("Generating plans...")
        self.generate_plans()
        print("Generating plan economics...")
        self.generate_plan_economics()
        print("Generating organizations...")
        self.generate_organizations()
        print("Generating users and memberships...")
        self.generate_users()
        print("Generating subscriptions...")
        self.generate_subscriptions()
        print("Generating API keys...")
        self.generate_api_keys()
        print("Generating projects...")
        self.generate_projects()
        print("Generating browser sessions...")
        self.generate_sessions()
        print("Generating session events...")
        self.generate_session_events()
        print("Generating usage records and invoices...")
        self.generate_usage_and_invoices()
        print("Done!")
    
    def to_sql(self) -> str:
        """Generate SQL INSERT statements."""
        sql_parts = []
        
        # Plans
        sql_parts.append("-- Plans")
        for p in self.plans:
            sql_parts.append(f"""INSERT INTO plans (id, name, display_name, monthly_price, sessions_per_month, concurrent_sessions, session_duration_mins, has_stealth_mode, has_residential_proxies, has_priority_support, created_at)
VALUES ('{p["id"]}', {escape_sql(p["name"])}, {escape_sql(p["display_name"])}, {p["monthly_price"]}, {p["sessions_per_month"] or 'NULL'}, {p["concurrent_sessions"]}, {p["session_duration_mins"]}, {str(p["has_stealth_mode"]).upper()}, {str(p["has_residential_proxies"]).upper()}, {str(p["has_priority_support"]).upper()}, '{p["created_at"]}');""")

        # Plan Economics
        sql_parts.append("\n-- Plan Economics")
        for pe in self.plan_economics:
            sql_parts.append(f"""INSERT INTO plan_economics (id, plan_id, expected_cost_per_hour_usd, effective_start, effective_end, notes, created_at)
VALUES ('{pe["id"]}', '{pe["plan_id"]}', {pe["expected_cost_per_hour_usd"]}, '{pe["effective_start"]}', {escape_sql(pe["effective_end"])}, {escape_sql(pe["notes"])}, '{pe["created_at"]}');""")
        
        # Organizations
        sql_parts.append("\n-- Organizations")
        for o in self.organizations:
            sql_parts.append(f"""INSERT INTO organizations (id, name, slug, stripe_customer_id, billing_email, status, created_at)
VALUES ('{o["id"]}', {escape_sql(o["name"])}, {escape_sql(o["slug"])}, {escape_sql(o["stripe_customer_id"])}, {escape_sql(o["billing_email"])}, {escape_sql(o["status"])}, '{o["created_at"]}');""")
        
        # Users
        sql_parts.append("\n-- Users")
        for u in self.users:
            sql_parts.append(f"""INSERT INTO users (id, email, full_name, avatar_url, auth_provider, email_verified, status, created_at, last_login_at)
VALUES ('{u["id"]}', {escape_sql(u["email"])}, {escape_sql(u["full_name"])}, {escape_sql(u["avatar_url"])}, {escape_sql(u["auth_provider"])}, {str(u["email_verified"]).upper()}, {escape_sql(u["status"])}, '{u["created_at"]}', {escape_sql(u["last_login_at"])});""")
        
        # Organization Members
        sql_parts.append("\n-- Organization Members")
        for m in self.org_members:
            sql_parts.append(f"""INSERT INTO organization_members (id, organization_id, user_id, role, invited_at, joined_at)
VALUES ('{m["id"]}', '{m["organization_id"]}', '{m["user_id"]}', {escape_sql(m["role"])}, '{m["invited_at"]}', '{m["joined_at"]}');""")
        
        # Subscriptions
        sql_parts.append("\n-- Subscriptions")
        for s in self.subscriptions:
            sql_parts.append(f"""INSERT INTO subscriptions (id, organization_id, plan_id, status, stripe_subscription_id, trial_ends_at, current_period_start, current_period_end, canceled_at, created_at)
VALUES ('{s["id"]}', '{s["organization_id"]}', '{s["plan_id"]}', {escape_sql(s["status"])}, {escape_sql(s["stripe_subscription_id"])}, {escape_sql(s["trial_ends_at"])}, '{s["current_period_start"]}', '{s["current_period_end"]}', {escape_sql(s["canceled_at"])}, '{s["created_at"]}');""")
        
        # API Keys
        sql_parts.append("\n-- API Keys")
        for k in self.api_keys:
            sql_parts.append(f"""INSERT INTO api_keys (id, organization_id, created_by, name, key_prefix, key_hash, scopes, status, last_used_at, expires_at, created_at)
VALUES ('{k["id"]}', '{k["organization_id"]}', {f"'{k['created_by']}'" if k["created_by"] else 'NULL'}, {escape_sql(k["name"])}, {escape_sql(k["key_prefix"])}, {escape_sql(k["key_hash"])}, {sql_array(k["scopes"])}, {escape_sql(k["status"])}, {escape_sql(k["last_used_at"])}, {escape_sql(k["expires_at"])}, '{k["created_at"]}');""")
        
        # Projects
        sql_parts.append("\n-- Projects")
        for p in self.projects:
            sql_parts.append(f"""INSERT INTO projects (id, organization_id, name, description, default_timeout_mins, default_viewport_width, default_viewport_height, status, created_at)
VALUES ('{p["id"]}', '{p["organization_id"]}', {escape_sql(p["name"])}, {escape_sql(p["description"])}, {p["default_timeout_mins"]}, {p["default_viewport_width"]}, {p["default_viewport_height"]}, {escape_sql(p["status"])}, '{p["created_at"]}');""")
        
        # Browser Sessions
        sql_parts.append("\n-- Browser Sessions")
        for s in self.sessions:
            sql_parts.append(f"""INSERT INTO browser_sessions (id, organization_id, project_id, api_key_id, browser_type, viewport_width, viewport_height, proxy_type, proxy_country, stealth_mode, status, started_at, ended_at, timeout_at, user_agent, initial_url, pages_visited, bytes_downloaded, bytes_uploaded, created_at)
VALUES ('{s["id"]}', '{s["organization_id"]}', {f"'{s['project_id']}'" if s["project_id"] else 'NULL'}, '{s["api_key_id"]}', {escape_sql(s["browser_type"])}, {s["viewport_width"]}, {s["viewport_height"]}, {escape_sql(s["proxy_type"])}, {escape_sql(s["proxy_country"])}, {str(s["stealth_mode"]).upper()}, {escape_sql(s["status"])}, '{s["started_at"]}', {escape_sql(s["ended_at"])}, '{s["timeout_at"]}', {escape_sql(s["user_agent"])}, {escape_sql(s["initial_url"])}, {s["pages_visited"]}, {s["bytes_downloaded"]}, {s["bytes_uploaded"]}, '{s["created_at"]}');""")
        
        # Session Events (limit for sanity)
        sql_parts.append("\n-- Session Events (sample)")
        for e in self.session_events[:5000]:  # Cap at 5k for reasonable file size
            sql_parts.append(f"""INSERT INTO session_events (id, session_id, event_type, event_data, page_url, page_title, timestamp)
VALUES ('{e["id"]}', '{e["session_id"]}', {escape_sql(e["event_type"])}, {sql_jsonb(e["event_data"])}, {escape_sql(e["page_url"])}, {escape_sql(e["page_title"])}, '{e["timestamp"]}');""")
        
        # Usage Records
        sql_parts.append("\n-- Usage Records")
        for u in self.usage_records:
            sql_parts.append(f"""INSERT INTO usage_records (id, organization_id, subscription_id, period_start, period_end, sessions_count, session_minutes, bytes_downloaded, bytes_uploaded, proxy_requests, created_at)
VALUES ('{u["id"]}', '{u["organization_id"]}', {f"'{u['subscription_id']}'" if u["subscription_id"] else 'NULL'}, '{u["period_start"]}', '{u["period_end"]}', {u["sessions_count"]}, {u["session_minutes"]}, {u["bytes_downloaded"]}, {u["bytes_uploaded"]}, {u["proxy_requests"]}, '{u["created_at"]}');""")
        
        # Invoices
        sql_parts.append("\n-- Invoices")
        for i in self.invoices:
            sql_parts.append(f"""INSERT INTO invoices (id, organization_id, subscription_id, stripe_invoice_id, subtotal, tax, total, status, period_start, period_end, due_date, paid_at, created_at)
VALUES ('{i["id"]}', '{i["organization_id"]}', {f"'{i['subscription_id']}'" if i["subscription_id"] else 'NULL'}, {escape_sql(i["stripe_invoice_id"])}, {i["subtotal"]}, {i["tax"]}, {i["total"]}, {escape_sql(i["status"])}, '{i["period_start"]}', '{i["period_end"]}', '{i["due_date"]}', {escape_sql(i["paid_at"])}, '{i["created_at"]}');""")
        
        return "\n".join(sql_parts)


if __name__ == "__main__":
    gen = DataGenerator()
    gen.generate_all()
    
    print(f"\nGenerated:")
    print(f"  - {len(gen.plans)} plans")
    print(f"  - {len(gen.plan_economics)} plan economics rows")
    print(f"  - {len(gen.organizations)} organizations")
    print(f"  - {len(gen.users)} users")
    print(f"  - {len(gen.org_members)} org memberships")
    print(f"  - {len(gen.subscriptions)} subscriptions")
    print(f"  - {len(gen.api_keys)} API keys")
    print(f"  - {len(gen.projects)} projects")
    print(f"  - {len(gen.sessions)} browser sessions")
    print(f"  - {len(gen.session_events)} session events")
    print(f"  - {len(gen.usage_records)} usage records")
    print(f"  - {len(gen.invoices)} invoices")
    
    # Write SQL
    sql = gen.to_sql()
    with open("seed.sql", "w") as f:
        f.write(sql)
    print(f"\nWrote seed.sql ({len(sql):,} bytes)")
