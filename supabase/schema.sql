-- =============================================================================
-- BROWSERBASE-LIKE SCHEMA (Supabase/Postgres)
-- Browser Infrastructure Platform
-- =============================================================================
-- Core Entities:
--   Organizations → Users → Projects → Sessions → Events
--   Plans → Subscriptions → Usage → Invoices
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PLANS (subscription tiers)
-- -----------------------------------------------------------------------------
CREATE TABLE plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,          -- 'free', 'starter', 'pro', 'enterprise'
    display_name    TEXT NOT NULL,
    monthly_price   NUMERIC(10, 2) NOT NULL,
    
    -- Usage limits
    sessions_per_month      INTEGER,               -- NULL = unlimited
    concurrent_sessions     INTEGER NOT NULL,
    session_duration_mins   INTEGER NOT NULL,      -- max duration per session
    
    -- Features
    has_stealth_mode        BOOLEAN DEFAULT FALSE,
    has_residential_proxies BOOLEAN DEFAULT FALSE,
    has_priority_support    BOOLEAN DEFAULT FALSE,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- ORGANIZATIONS (the paying entity)
-- -----------------------------------------------------------------------------
CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,          -- url-friendly identifier
    
    -- Billing
    stripe_customer_id  TEXT,
    billing_email       TEXT,
    
    -- Status
    status          TEXT DEFAULT 'active',         -- 'active', 'suspended', 'churned'
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- USERS (individual humans)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    full_name       TEXT,
    avatar_url      TEXT,
    
    -- Auth (Supabase Auth integration)
    auth_provider   TEXT DEFAULT 'email',          -- 'email', 'github', 'google'
    
    -- Status
    email_verified  BOOLEAN DEFAULT FALSE,
    status          TEXT DEFAULT 'active',         -- 'active', 'suspended', 'deleted'
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- ORGANIZATION_MEMBERS (many-to-many: users ↔ orgs)
-- -----------------------------------------------------------------------------
CREATE TABLE organization_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    
    role            TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
    
    invited_at      TIMESTAMPTZ DEFAULT NOW(),
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, user_id)
);

-- -----------------------------------------------------------------------------
-- SUBSCRIPTIONS (org's plan subscription)
-- -----------------------------------------------------------------------------
CREATE TABLE subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    plan_id         UUID NOT NULL REFERENCES plans(id),
    
    status          TEXT NOT NULL DEFAULT 'active', -- 'trialing', 'active', 'past_due', 'canceled'
    
    -- Stripe
    stripe_subscription_id TEXT,
    
    -- Dates
    trial_ends_at   TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end   TIMESTAMPTZ NOT NULL,
    canceled_at     TIMESTAMPTZ,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- API_KEYS (authentication for programmatic access)
-- -----------------------------------------------------------------------------
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_by      UUID REFERENCES users(id),
    
    name            TEXT NOT NULL,                 -- user-friendly label
    key_prefix      TEXT NOT NULL,                 -- first 8 chars for identification
    key_hash        TEXT NOT NULL,                 -- hashed full key
    
    -- Permissions
    scopes          TEXT[] DEFAULT '{}',           -- 'sessions:read', 'sessions:write', etc.
    
    -- Status
    status          TEXT DEFAULT 'active',         -- 'active', 'revoked'
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- PROJECTS (logical groupings within an org)
-- -----------------------------------------------------------------------------
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    name            TEXT NOT NULL,
    description     TEXT,
    
    -- Default session settings
    default_timeout_mins    INTEGER DEFAULT 30,
    default_viewport_width  INTEGER DEFAULT 1920,
    default_viewport_height INTEGER DEFAULT 1080,
    
    status          TEXT DEFAULT 'active',         -- 'active', 'archived'
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- BROWSER_SESSIONS (the core product - each browser instance)
-- -----------------------------------------------------------------------------
CREATE TABLE browser_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    project_id      UUID REFERENCES projects(id),
    api_key_id      UUID REFERENCES api_keys(id),
    
    -- Session config
    browser_type    TEXT NOT NULL DEFAULT 'chromium', -- 'chromium', 'firefox', 'webkit'
    viewport_width  INTEGER DEFAULT 1920,
    viewport_height INTEGER DEFAULT 1080,
    
    -- Proxy settings
    proxy_type      TEXT,                          -- NULL, 'datacenter', 'residential'
    proxy_country   TEXT,
    
    -- Stealth / anti-detection
    stealth_mode    BOOLEAN DEFAULT FALSE,
    
    -- Status
    status          TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'timeout'
    
    -- Timing
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    timeout_at      TIMESTAMPTZ,
    
    -- Metadata
    user_agent      TEXT,
    initial_url     TEXT,
    
    -- Usage tracking
    pages_visited   INTEGER DEFAULT 0,
    bytes_downloaded BIGINT DEFAULT 0,
    bytes_uploaded  BIGINT DEFAULT 0,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- SESSION_EVENTS (what happened during a session)
-- -----------------------------------------------------------------------------
CREATE TABLE session_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES browser_sessions(id),
    
    event_type      TEXT NOT NULL,                 -- 'navigation', 'click', 'input', 'screenshot', 'error', 'console'
    event_data      JSONB,                         -- event-specific payload
    
    -- Context
    page_url        TEXT,
    page_title      TEXT,
    
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- SESSION_RECORDINGS (optional session replay data)
-- -----------------------------------------------------------------------------
CREATE TABLE session_recordings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES browser_sessions(id),
    
    storage_url     TEXT NOT NULL,                 -- S3/R2 URL
    size_bytes      BIGINT NOT NULL,
    duration_ms     INTEGER NOT NULL,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- USAGE_RECORDS (for billing/metering)
-- -----------------------------------------------------------------------------
CREATE TABLE usage_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    subscription_id UUID REFERENCES subscriptions(id),
    
    -- Period
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    
    -- Metrics
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
-- INVOICES (billing records)
-- -----------------------------------------------------------------------------
CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    subscription_id UUID REFERENCES subscriptions(id),
    
    stripe_invoice_id TEXT,
    
    -- Amounts (in cents)
    subtotal        INTEGER NOT NULL,
    tax             INTEGER DEFAULT 0,
    total           INTEGER NOT NULL,
    
    -- Status
    status          TEXT NOT NULL,                 -- 'draft', 'open', 'paid', 'void', 'uncollectible'
    
    -- Dates
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    due_date        DATE,
    paid_at         TIMESTAMPTZ,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES (for query performance)
-- =============================================================================

-- Organizations
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_created_at ON organizations(created_at);

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Organization Members
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);

-- Subscriptions
CREATE INDEX idx_subscriptions_org_id ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- API Keys
CREATE INDEX idx_api_keys_org_id ON api_keys(organization_id);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);

-- Projects
CREATE INDEX idx_projects_org_id ON projects(organization_id);

-- Browser Sessions (heavily queried)
CREATE INDEX idx_sessions_org_id ON browser_sessions(organization_id);
CREATE INDEX idx_sessions_project_id ON browser_sessions(project_id);
CREATE INDEX idx_sessions_status ON browser_sessions(status);
CREATE INDEX idx_sessions_created_at ON browser_sessions(created_at);
CREATE INDEX idx_sessions_started_at ON browser_sessions(started_at);

-- Session Events
CREATE INDEX idx_session_events_session_id ON session_events(session_id);
CREATE INDEX idx_session_events_type ON session_events(event_type);
CREATE INDEX idx_session_events_timestamp ON session_events(timestamp);

-- Usage Records
CREATE INDEX idx_usage_org_id ON usage_records(organization_id);
CREATE INDEX idx_usage_period ON usage_records(period_start, period_end);

-- Invoices
CREATE INDEX idx_invoices_org_id ON invoices(organization_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- =============================================================================
-- TRIGGERS (updated_at automation)
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_sessions_updated_at
    BEFORE UPDATE ON browser_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_usage_records_updated_at
    BEFORE UPDATE ON usage_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
