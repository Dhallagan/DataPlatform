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
-- GTM SCHEMA (Salesforce-like go-to-market data)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS gtm;

-- Internal GTM employees (distinct from customer product users)
CREATE TABLE gtm.employees (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_email      TEXT NOT NULL UNIQUE,
    full_name           TEXT,
    role_title          TEXT,
    team                TEXT,
    manager_employee_id UUID REFERENCES gtm.employees(id) ON DELETE SET NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts (companies being worked by sales/growth)
CREATE TABLE gtm.accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id),
    name                TEXT NOT NULL,
    website_domain      TEXT,
    industry            TEXT,
    employee_band       TEXT,   -- '1-10', '11-50', '51-200', '201-1000', '1000+'
    account_tier        TEXT,   -- 'tier_1', 'tier_2', 'tier_3'
    account_status      TEXT DEFAULT 'target', -- 'target', 'engaged', 'customer', 'churned'
    owner_user_id       UUID REFERENCES users(id),
    owner_employee_id   UUID REFERENCES gtm.employees(id),
    source_system       TEXT DEFAULT 'salesforce_sim',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts (people at target/customer accounts)
CREATE TABLE gtm.contacts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID NOT NULL REFERENCES gtm.accounts(id) ON DELETE CASCADE,
    email               TEXT NOT NULL,
    full_name           TEXT,
    title               TEXT,
    department          TEXT,
    seniority           TEXT,   -- 'ic', 'manager', 'director', 'vp', 'c_level'
    lifecycle_stage     TEXT DEFAULT 'prospect', -- 'prospect', 'lead', 'mql', 'sql', 'customer'
    is_primary_contact  BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, email)
);

-- Leads (inbound/outbound lead records)
CREATE TABLE gtm.leads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID REFERENCES gtm.accounts(id) ON DELETE SET NULL,
    contact_id          UUID REFERENCES gtm.contacts(id) ON DELETE SET NULL,
    lead_source         TEXT NOT NULL, -- 'inbound', 'outbound', 'partner', 'referral', 'plg'
    lead_status         TEXT DEFAULT 'new', -- 'new', 'working', 'nurturing', 'qualified', 'unqualified', 'converted'
    source_detail       TEXT, -- campaign/content/source details
    score               INTEGER DEFAULT 0,
    owner_user_id       UUID REFERENCES users(id),
    owner_employee_id   UUID REFERENCES gtm.employees(id),
    first_touch_at      TIMESTAMPTZ,
    converted_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns (marketing and outbound campaigns)
CREATE TABLE gtm.campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    channel             TEXT NOT NULL, -- 'google_ads', 'linkedin_ads', 'email', 'events', 'outbound'
    objective           TEXT,          -- 'awareness', 'lead_gen', 'pipeline', 'expansion'
    status              TEXT DEFAULT 'planned', -- 'planned', 'active', 'paused', 'completed'
    budget_usd          NUMERIC(12,2),
    start_date          DATE,
    end_date            DATE,
    owner_user_id       UUID REFERENCES users(id),
    owner_employee_id   UUID REFERENCES gtm.employees(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Lead attribution touches
CREATE TABLE gtm.lead_touches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id             UUID NOT NULL REFERENCES gtm.leads(id) ON DELETE CASCADE,
    campaign_id         UUID REFERENCES gtm.campaigns(id) ON DELETE SET NULL,
    touch_type          TEXT NOT NULL, -- 'first_touch', 'last_touch', 'influence'
    touch_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    channel             TEXT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Opportunities (pipeline/deal records)
CREATE TABLE gtm.opportunities (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id              UUID NOT NULL REFERENCES gtm.accounts(id) ON DELETE CASCADE,
    primary_contact_id      UUID REFERENCES gtm.contacts(id) ON DELETE SET NULL,
    originating_lead_id     UUID REFERENCES gtm.leads(id) ON DELETE SET NULL,
    opportunity_name        TEXT NOT NULL,
    stage                   TEXT NOT NULL DEFAULT 'prospecting', -- 'prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
    amount_usd              NUMERIC(12,2),
    forecast_category       TEXT, -- 'pipeline', 'best_case', 'commit'
    expected_close_date     DATE,
    closed_at               TIMESTAMPTZ,
    is_won                  BOOLEAN,
    loss_reason             TEXT,
    owner_user_id           UUID REFERENCES users(id),
    owner_employee_id       UUID REFERENCES gtm.employees(id),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Activities (calls, emails, meetings, demos, tasks)
CREATE TABLE gtm.activities (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id              UUID REFERENCES gtm.accounts(id) ON DELETE SET NULL,
    contact_id              UUID REFERENCES gtm.contacts(id) ON DELETE SET NULL,
    lead_id                 UUID REFERENCES gtm.leads(id) ON DELETE SET NULL,
    opportunity_id          UUID REFERENCES gtm.opportunities(id) ON DELETE SET NULL,
    activity_type           TEXT NOT NULL, -- 'email', 'call', 'meeting', 'demo', 'task'
    direction               TEXT,          -- 'inbound', 'outbound'
    subject                 TEXT,
    outcome                 TEXT,
    occurred_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    owner_user_id           UUID REFERENCES users(id),
    owner_employee_id       UUID REFERENCES gtm.employees(id),
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- FINANCE SCHEMA (Ramp-like spend management + AP)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS finance;

CREATE TABLE finance.departments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name                TEXT NOT NULL,
    cost_center         TEXT,
    budget_usd          NUMERIC(12,2),
    owner_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    status              TEXT DEFAULT 'active', -- 'active', 'archived'
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

CREATE TABLE finance.vendors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    vendor_name         TEXT NOT NULL,
    category            TEXT,
    status              TEXT DEFAULT 'active', -- 'active', 'inactive', 'blocked'
    payment_terms       TEXT,                  -- 'net_15', 'net_30', 'net_45'
    risk_level          TEXT,                  -- 'low', 'medium', 'high'
    country             TEXT,
    currency            TEXT DEFAULT 'USD',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE finance.cards (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    card_last4          TEXT NOT NULL,
    card_brand          TEXT, -- 'visa', 'mastercard', 'amex'
    card_type           TEXT DEFAULT 'virtual', -- 'virtual', 'physical'
    cardholder_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    department_id       UUID REFERENCES finance.departments(id) ON DELETE SET NULL,
    vendor_id           UUID REFERENCES finance.vendors(id) ON DELETE SET NULL,
    spend_limit_usd     NUMERIC(12,2),
    status              TEXT DEFAULT 'active', -- 'active', 'frozen', 'canceled'
    issued_at           TIMESTAMPTZ,
    frozen_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE finance.transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    card_id             UUID REFERENCES finance.cards(id) ON DELETE SET NULL,
    vendor_id           UUID REFERENCES finance.vendors(id) ON DELETE SET NULL,
    department_id       UUID REFERENCES finance.departments(id) ON DELETE SET NULL,
    merchant_name       TEXT,
    merchant_category   TEXT,
    amount_usd          NUMERIC(12,2) NOT NULL,
    currency            TEXT DEFAULT 'USD',
    transaction_type    TEXT DEFAULT 'card_purchase', -- 'card_purchase', 'cash_withdrawal', 'credit'
    status              TEXT DEFAULT 'posted',        -- 'pending', 'posted', 'cleared', 'declined', 'reversed'
    transaction_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at          TIMESTAMPTZ,
    memo                TEXT,
    receipt_url         TEXT,
    created_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE finance.reimbursements (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID REFERENCES organizations(id) ON DELETE SET NULL,
    submitted_by_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    department_id           UUID REFERENCES finance.departments(id) ON DELETE SET NULL,
    vendor_id               UUID REFERENCES finance.vendors(id) ON DELETE SET NULL,
    amount_usd              NUMERIC(12,2) NOT NULL,
    currency                TEXT DEFAULT 'USD',
    status                  TEXT DEFAULT 'submitted', -- 'submitted', 'approved', 'rejected', 'paid'
    expense_date            DATE,
    submitted_at            TIMESTAMPTZ DEFAULT NOW(),
    approved_at             TIMESTAMPTZ,
    paid_at                 TIMESTAMPTZ,
    memo                    TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE finance.bills (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    vendor_id           UUID REFERENCES finance.vendors(id) ON DELETE SET NULL,
    department_id       UUID REFERENCES finance.departments(id) ON DELETE SET NULL,
    bill_number         TEXT,
    bill_date           DATE,
    due_date            DATE,
    amount_usd          NUMERIC(12,2) NOT NULL,
    currency            TEXT DEFAULT 'USD',
    status              TEXT DEFAULT 'submitted', -- 'submitted', 'approved', 'scheduled', 'paid', 'void'
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    memo                TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE finance.bill_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    bill_id             UUID REFERENCES finance.bills(id) ON DELETE CASCADE,
    payment_method      TEXT, -- 'ach', 'wire', 'card'
    amount_usd          NUMERIC(12,2) NOT NULL,
    currency            TEXT DEFAULT 'USD',
    paid_at             TIMESTAMPTZ,
    status              TEXT DEFAULT 'scheduled', -- 'scheduled', 'processing', 'paid', 'failed', 'canceled'
    external_payment_id TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Bill-level accounting adjustments (credit memo/write-off/reversal)
CREATE TABLE finance.bill_adjustments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    bill_id             UUID NOT NULL REFERENCES finance.bills(id) ON DELETE CASCADE,
    adjustment_type     TEXT NOT NULL DEFAULT 'credit_memo', -- 'credit_memo', 'write_off', 'reversal', 'other'
    direction           TEXT NOT NULL DEFAULT 'decrease',    -- 'decrease', 'increase'
    amount_usd          NUMERIC(12,2) NOT NULL,
    currency            TEXT DEFAULT 'USD',
    reason              TEXT,
    adjusted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Payment reversal ledger records (audit trail for reversed payments)
CREATE TABLE finance.payment_reversals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    original_payment_id UUID NOT NULL REFERENCES finance.bill_payments(id) ON DELETE CASCADE,
    bill_id             UUID REFERENCES finance.bills(id) ON DELETE SET NULL,
    reversal_amount_usd NUMERIC(12,2) NOT NULL,
    currency            TEXT DEFAULT 'USD',
    status              TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'canceled'
    reversal_reason     TEXT,
    reversed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
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

-- GTM
CREATE INDEX idx_gtm_accounts_org_id ON gtm.accounts(organization_id);
CREATE INDEX idx_gtm_accounts_status ON gtm.accounts(account_status);
CREATE INDEX idx_gtm_accounts_owner_employee_id ON gtm.accounts(owner_employee_id);
CREATE INDEX idx_gtm_contacts_account_id ON gtm.contacts(account_id);
CREATE INDEX idx_gtm_leads_account_id ON gtm.leads(account_id);
CREATE INDEX idx_gtm_leads_status ON gtm.leads(lead_status);
CREATE INDEX idx_gtm_leads_source ON gtm.leads(lead_source);
CREATE INDEX idx_gtm_leads_owner_employee_id ON gtm.leads(owner_employee_id);
CREATE INDEX idx_gtm_campaigns_status ON gtm.campaigns(status);
CREATE INDEX idx_gtm_campaigns_owner_employee_id ON gtm.campaigns(owner_employee_id);
CREATE INDEX idx_gtm_touches_lead_id ON gtm.lead_touches(lead_id);
CREATE INDEX idx_gtm_touches_campaign_id ON gtm.lead_touches(campaign_id);
CREATE INDEX idx_gtm_opps_account_id ON gtm.opportunities(account_id);
CREATE INDEX idx_gtm_opps_stage ON gtm.opportunities(stage);
CREATE INDEX idx_gtm_opps_owner_employee_id ON gtm.opportunities(owner_employee_id);
CREATE INDEX idx_gtm_activities_account_id ON gtm.activities(account_id);
CREATE INDEX idx_gtm_activities_occurred_at ON gtm.activities(occurred_at);
CREATE INDEX idx_gtm_activities_owner_employee_id ON gtm.activities(owner_employee_id);

-- Finance
CREATE INDEX idx_finance_departments_org_id ON finance.departments(organization_id);
CREATE INDEX idx_finance_departments_status ON finance.departments(status);
CREATE INDEX idx_finance_vendors_org_id ON finance.vendors(organization_id);
CREATE INDEX idx_finance_vendors_status ON finance.vendors(status);
CREATE INDEX idx_finance_cards_org_id ON finance.cards(organization_id);
CREATE INDEX idx_finance_cards_status ON finance.cards(status);
CREATE INDEX idx_finance_txn_org_id ON finance.transactions(organization_id);
CREATE INDEX idx_finance_txn_status ON finance.transactions(status);
CREATE INDEX idx_finance_txn_at ON finance.transactions(transaction_at);
CREATE INDEX idx_finance_reim_org_id ON finance.reimbursements(organization_id);
CREATE INDEX idx_finance_reim_status ON finance.reimbursements(status);
CREATE INDEX idx_finance_bills_org_id ON finance.bills(organization_id);
CREATE INDEX idx_finance_bills_status ON finance.bills(status);
CREATE INDEX idx_finance_bill_payments_bill_id ON finance.bill_payments(bill_id);
CREATE INDEX idx_finance_bill_payments_status ON finance.bill_payments(status);
CREATE INDEX idx_finance_bill_adj_org_id ON finance.bill_adjustments(organization_id);
CREATE INDEX idx_finance_bill_adj_bill_id ON finance.bill_adjustments(bill_id);
CREATE INDEX idx_finance_bill_adj_at ON finance.bill_adjustments(adjusted_at);
CREATE INDEX idx_finance_payment_rev_org_id ON finance.payment_reversals(organization_id);
CREATE INDEX idx_finance_payment_rev_payment_id ON finance.payment_reversals(original_payment_id);
CREATE INDEX idx_finance_payment_rev_bill_id ON finance.payment_reversals(bill_id);
CREATE INDEX idx_finance_payment_rev_status ON finance.payment_reversals(status);
CREATE INDEX idx_finance_payment_rev_at ON finance.payment_reversals(reversed_at);

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

CREATE TRIGGER trg_gtm_accounts_updated_at
    BEFORE UPDATE ON gtm.accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_gtm_contacts_updated_at
    BEFORE UPDATE ON gtm.contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_gtm_leads_updated_at
    BEFORE UPDATE ON gtm.leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_gtm_campaigns_updated_at
    BEFORE UPDATE ON gtm.campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_gtm_opportunities_updated_at
    BEFORE UPDATE ON gtm.opportunities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_finance_departments_updated_at
    BEFORE UPDATE ON finance.departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_finance_vendors_updated_at
    BEFORE UPDATE ON finance.vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_finance_cards_updated_at
    BEFORE UPDATE ON finance.cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_finance_transactions_updated_at
    BEFORE UPDATE ON finance.transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_finance_reimbursements_updated_at
    BEFORE UPDATE ON finance.reimbursements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_finance_bills_updated_at
    BEFORE UPDATE ON finance.bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
