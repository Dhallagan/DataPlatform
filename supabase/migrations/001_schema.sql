-- =============================================================================
-- BROWSERBASE SCHEMA - Supabase Migration
-- =============================================================================
-- Run this first in Supabase SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PLANS (subscription tiers)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    monthly_price   NUMERIC(10, 2) NOT NULL,
    sessions_per_month      INTEGER,
    concurrent_sessions     INTEGER NOT NULL,
    session_duration_mins   INTEGER NOT NULL,
    has_stealth_mode        BOOLEAN DEFAULT FALSE,
    has_residential_proxies BOOLEAN DEFAULT FALSE,
    has_priority_support    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- ORGANIZATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    stripe_customer_id  TEXT,
    billing_email       TEXT,
    status          TEXT DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- USERS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    full_name       TEXT,
    avatar_url      TEXT,
    auth_provider   TEXT DEFAULT 'email',
    email_verified  BOOLEAN DEFAULT FALSE,
    status          TEXT DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- ORGANIZATION_MEMBERS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'member',
    invited_at      TIMESTAMPTZ DEFAULT NOW(),
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- -----------------------------------------------------------------------------
-- SUBSCRIPTIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id         UUID NOT NULL REFERENCES plans(id),
    status          TEXT NOT NULL DEFAULT 'active',
    stripe_subscription_id TEXT,
    trial_ends_at   TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end   TIMESTAMPTZ NOT NULL,
    canceled_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- API_KEYS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES users(id),
    name            TEXT NOT NULL,
    key_prefix      TEXT NOT NULL,
    key_hash        TEXT NOT NULL,
    scopes          TEXT[] DEFAULT '{}',
    status          TEXT DEFAULT 'active',
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- PROJECTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    default_timeout_mins    INTEGER DEFAULT 30,
    default_viewport_width  INTEGER DEFAULT 1920,
    default_viewport_height INTEGER DEFAULT 1080,
    status          TEXT DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- BROWSER_SESSIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS browser_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
    api_key_id      UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    browser_type    TEXT NOT NULL DEFAULT 'chromium',
    viewport_width  INTEGER DEFAULT 1920,
    viewport_height INTEGER DEFAULT 1080,
    proxy_type      TEXT,
    proxy_country   TEXT,
    stealth_mode    BOOLEAN DEFAULT FALSE,
    status          TEXT NOT NULL DEFAULT 'pending',
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    timeout_at      TIMESTAMPTZ,
    user_agent      TEXT,
    initial_url     TEXT,
    pages_visited   INTEGER DEFAULT 0,
    bytes_downloaded BIGINT DEFAULT 0,
    bytes_uploaded  BIGINT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- SESSION_EVENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES browser_sessions(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    event_data      JSONB,
    page_url        TEXT,
    page_title      TEXT,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- SESSION_RECORDINGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_recordings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES browser_sessions(id) ON DELETE CASCADE,
    storage_url     TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    duration_ms     INTEGER NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- USAGE_RECORDS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    sessions_count          INTEGER DEFAULT 0,
    session_minutes         NUMERIC(12, 2) DEFAULT 0,
    bytes_downloaded        BIGINT DEFAULT 0,
    bytes_uploaded          BIGINT DEFAULT 0,
    proxy_requests          INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, period_start, period_end)
);

-- -----------------------------------------------------------------------------
-- INVOICES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id),
    stripe_invoice_id TEXT,
    subtotal        INTEGER NOT NULL,
    tax             INTEGER DEFAULT 0,
    total           INTEGER NOT NULL,
    status          TEXT NOT NULL,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    due_date        DATE,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_org_id ON browser_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON browser_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON browser_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON browser_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON browser_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_session_events_type ON session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_session_events_timestamp ON session_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_org_id ON usage_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_period ON usage_records(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- =============================================================================
-- ROW LEVEL SECURITY (Optional - enable for production)
-- =============================================================================
-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE browser_sessions ENABLE ROW LEVEL SECURITY;
-- etc.
