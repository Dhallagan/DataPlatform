-- =============================================================================
-- BROWSERBASE SCHEMA - Migration 005 (GTM Employee Ownership)
-- =============================================================================
-- Separates internal GTM employee identity from product users.
-- Additive-only migration for safe rollout.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS gtm;

CREATE TABLE IF NOT EXISTS gtm.employees (
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

ALTER TABLE gtm.accounts
    ADD COLUMN IF NOT EXISTS owner_employee_id UUID REFERENCES gtm.employees(id) ON DELETE SET NULL;

ALTER TABLE gtm.leads
    ADD COLUMN IF NOT EXISTS owner_employee_id UUID REFERENCES gtm.employees(id) ON DELETE SET NULL;

ALTER TABLE gtm.campaigns
    ADD COLUMN IF NOT EXISTS owner_employee_id UUID REFERENCES gtm.employees(id) ON DELETE SET NULL;

ALTER TABLE gtm.opportunities
    ADD COLUMN IF NOT EXISTS owner_employee_id UUID REFERENCES gtm.employees(id) ON DELETE SET NULL;

ALTER TABLE gtm.activities
    ADD COLUMN IF NOT EXISTS owner_employee_id UUID REFERENCES gtm.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gtm_employees_active ON gtm.employees(is_active);
CREATE INDEX IF NOT EXISTS idx_gtm_accounts_owner_employee_id ON gtm.accounts(owner_employee_id);
CREATE INDEX IF NOT EXISTS idx_gtm_leads_owner_employee_id ON gtm.leads(owner_employee_id);
CREATE INDEX IF NOT EXISTS idx_gtm_campaigns_owner_employee_id ON gtm.campaigns(owner_employee_id);
CREATE INDEX IF NOT EXISTS idx_gtm_opps_owner_employee_id ON gtm.opportunities(owner_employee_id);
CREATE INDEX IF NOT EXISTS idx_gtm_activities_owner_employee_id ON gtm.activities(owner_employee_id);
