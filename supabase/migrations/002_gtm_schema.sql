-- =============================================================================
-- BROWSERBASE SCHEMA - Migration 002 (GTM)
-- =============================================================================
-- Additive-only migration for Salesforce-like go-to-market entities.
-- Safe for existing environments: no drops, no destructive changes.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS gtm;

CREATE TABLE IF NOT EXISTS gtm.accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name                TEXT NOT NULL,
    website_domain      TEXT,
    industry            TEXT,
    employee_band       TEXT,
    account_tier        TEXT,
    account_status      TEXT DEFAULT 'target',
    owner_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    source_system       TEXT DEFAULT 'salesforce_sim',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gtm.contacts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID NOT NULL REFERENCES gtm.accounts(id) ON DELETE CASCADE,
    email               TEXT NOT NULL,
    full_name           TEXT,
    title               TEXT,
    department          TEXT,
    seniority           TEXT,
    lifecycle_stage     TEXT DEFAULT 'prospect',
    is_primary_contact  BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, email)
);

CREATE TABLE IF NOT EXISTS gtm.leads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID REFERENCES gtm.accounts(id) ON DELETE SET NULL,
    contact_id          UUID REFERENCES gtm.contacts(id) ON DELETE SET NULL,
    lead_source         TEXT NOT NULL,
    lead_status         TEXT DEFAULT 'new',
    source_detail       TEXT,
    score               INTEGER DEFAULT 0,
    owner_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    first_touch_at      TIMESTAMPTZ,
    converted_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gtm.campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    channel             TEXT NOT NULL,
    objective           TEXT,
    status              TEXT DEFAULT 'planned',
    budget_usd          NUMERIC(12,2),
    start_date          DATE,
    end_date            DATE,
    owner_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gtm.lead_touches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id             UUID NOT NULL REFERENCES gtm.leads(id) ON DELETE CASCADE,
    campaign_id         UUID REFERENCES gtm.campaigns(id) ON DELETE SET NULL,
    touch_type          TEXT NOT NULL,
    touch_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    channel             TEXT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gtm.opportunities (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id              UUID NOT NULL REFERENCES gtm.accounts(id) ON DELETE CASCADE,
    primary_contact_id      UUID REFERENCES gtm.contacts(id) ON DELETE SET NULL,
    originating_lead_id     UUID REFERENCES gtm.leads(id) ON DELETE SET NULL,
    opportunity_name        TEXT NOT NULL,
    stage                   TEXT NOT NULL DEFAULT 'prospecting',
    amount_usd              NUMERIC(12,2),
    forecast_category       TEXT,
    expected_close_date     DATE,
    closed_at               TIMESTAMPTZ,
    is_won                  BOOLEAN,
    loss_reason             TEXT,
    owner_user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gtm.activities (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id              UUID REFERENCES gtm.accounts(id) ON DELETE SET NULL,
    contact_id              UUID REFERENCES gtm.contacts(id) ON DELETE SET NULL,
    lead_id                 UUID REFERENCES gtm.leads(id) ON DELETE SET NULL,
    opportunity_id          UUID REFERENCES gtm.opportunities(id) ON DELETE SET NULL,
    activity_type           TEXT NOT NULL,
    direction               TEXT,
    subject                 TEXT,
    outcome                 TEXT,
    occurred_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    owner_user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gtm_accounts_org_id ON gtm.accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_gtm_accounts_status ON gtm.accounts(account_status);
CREATE INDEX IF NOT EXISTS idx_gtm_contacts_account_id ON gtm.contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_gtm_leads_account_id ON gtm.leads(account_id);
CREATE INDEX IF NOT EXISTS idx_gtm_leads_status ON gtm.leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_gtm_leads_source ON gtm.leads(lead_source);
CREATE INDEX IF NOT EXISTS idx_gtm_campaigns_status ON gtm.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_gtm_touches_lead_id ON gtm.lead_touches(lead_id);
CREATE INDEX IF NOT EXISTS idx_gtm_touches_campaign_id ON gtm.lead_touches(campaign_id);
CREATE INDEX IF NOT EXISTS idx_gtm_opps_account_id ON gtm.opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_gtm_opps_stage ON gtm.opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_gtm_activities_account_id ON gtm.activities(account_id);
CREATE INDEX IF NOT EXISTS idx_gtm_activities_occurred_at ON gtm.activities(occurred_at);
