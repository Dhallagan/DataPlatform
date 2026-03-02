-- =============================================================================
-- BROWSERBASE SCHEMA - Migration 003 (Finance / Ramp-like)
-- =============================================================================
-- Additive-only migration for spend-management and AP workflows.
-- Safe for existing environments: no drops, no destructive changes.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS finance;

CREATE TABLE IF NOT EXISTS finance.departments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name                TEXT NOT NULL,
    cost_center         TEXT,
    budget_usd          NUMERIC(12,2),
    owner_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    status              TEXT DEFAULT 'active',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS finance.vendors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    vendor_name         TEXT NOT NULL,
    category            TEXT,
    status              TEXT DEFAULT 'active',
    payment_terms       TEXT,
    risk_level          TEXT,
    country             TEXT,
    currency            TEXT DEFAULT 'USD',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance.cards (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    card_last4          TEXT NOT NULL,
    card_brand          TEXT,
    card_type           TEXT DEFAULT 'virtual',
    cardholder_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    department_id       UUID REFERENCES finance.departments(id) ON DELETE SET NULL,
    vendor_id           UUID REFERENCES finance.vendors(id) ON DELETE SET NULL,
    spend_limit_usd     NUMERIC(12,2),
    status              TEXT DEFAULT 'active',
    issued_at           TIMESTAMPTZ,
    frozen_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance.transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    card_id             UUID REFERENCES finance.cards(id) ON DELETE SET NULL,
    vendor_id           UUID REFERENCES finance.vendors(id) ON DELETE SET NULL,
    department_id       UUID REFERENCES finance.departments(id) ON DELETE SET NULL,
    merchant_name       TEXT,
    merchant_category   TEXT,
    amount_usd          NUMERIC(12,2) NOT NULL,
    currency            TEXT DEFAULT 'USD',
    transaction_type    TEXT DEFAULT 'card_purchase',
    status              TEXT DEFAULT 'posted',
    transaction_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at          TIMESTAMPTZ,
    memo                TEXT,
    receipt_url         TEXT,
    created_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance.reimbursements (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         UUID REFERENCES organizations(id) ON DELETE SET NULL,
    submitted_by_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    department_id           UUID REFERENCES finance.departments(id) ON DELETE SET NULL,
    vendor_id               UUID REFERENCES finance.vendors(id) ON DELETE SET NULL,
    amount_usd              NUMERIC(12,2) NOT NULL,
    currency                TEXT DEFAULT 'USD',
    status                  TEXT DEFAULT 'submitted',
    expense_date            DATE,
    submitted_at            TIMESTAMPTZ DEFAULT NOW(),
    approved_at             TIMESTAMPTZ,
    paid_at                 TIMESTAMPTZ,
    memo                    TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance.bills (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    vendor_id           UUID REFERENCES finance.vendors(id) ON DELETE SET NULL,
    department_id       UUID REFERENCES finance.departments(id) ON DELETE SET NULL,
    bill_number         TEXT,
    bill_date           DATE,
    due_date            DATE,
    amount_usd          NUMERIC(12,2) NOT NULL,
    currency            TEXT DEFAULT 'USD',
    status              TEXT DEFAULT 'submitted',
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    memo                TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance.bill_payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    bill_id             UUID REFERENCES finance.bills(id) ON DELETE CASCADE,
    payment_method      TEXT,
    amount_usd          NUMERIC(12,2) NOT NULL,
    currency            TEXT DEFAULT 'USD',
    paid_at             TIMESTAMPTZ,
    status              TEXT DEFAULT 'scheduled',
    external_payment_id TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_departments_org_id ON finance.departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_finance_departments_status ON finance.departments(status);
CREATE INDEX IF NOT EXISTS idx_finance_vendors_org_id ON finance.vendors(organization_id);
CREATE INDEX IF NOT EXISTS idx_finance_vendors_status ON finance.vendors(status);
CREATE INDEX IF NOT EXISTS idx_finance_cards_org_id ON finance.cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_finance_cards_status ON finance.cards(status);
CREATE INDEX IF NOT EXISTS idx_finance_txn_org_id ON finance.transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_finance_txn_status ON finance.transactions(status);
CREATE INDEX IF NOT EXISTS idx_finance_txn_at ON finance.transactions(transaction_at);
CREATE INDEX IF NOT EXISTS idx_finance_reim_org_id ON finance.reimbursements(organization_id);
CREATE INDEX IF NOT EXISTS idx_finance_reim_status ON finance.reimbursements(status);
CREATE INDEX IF NOT EXISTS idx_finance_bills_org_id ON finance.bills(organization_id);
CREATE INDEX IF NOT EXISTS idx_finance_bills_status ON finance.bills(status);
CREATE INDEX IF NOT EXISTS idx_finance_bill_payments_bill_id ON finance.bill_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_finance_bill_payments_status ON finance.bill_payments(status);
