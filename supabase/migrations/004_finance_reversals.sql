-- =============================================================================
-- BROWSERBASE SCHEMA - Migration 004 (Finance Reversals / Adjustments)
-- =============================================================================
-- Additive-only migration for audit-friendly accounting reversal workflows.
-- Safe for existing environments: no drops, no destructive changes.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS finance;

CREATE TABLE IF NOT EXISTS finance.bill_adjustments (
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

CREATE TABLE IF NOT EXISTS finance.payment_reversals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID REFERENCES organizations(id) ON DELETE SET NULL,
    original_payment_id UUID NOT NULL REFERENCES finance.bill_payments(id) ON DELETE CASCADE,
    bill_id             UUID REFERENCES finance.bills(id) ON DELETE SET NULL,
    reversal_amount_usd NUMERIC(12,2) NOT NULL,
    currency            TEXT DEFAULT 'USD',
    status              TEXT NOT NULL DEFAULT 'completed',   -- 'pending', 'completed', 'failed', 'canceled'
    reversal_reason     TEXT,
    reversed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_bill_adj_org_id ON finance.bill_adjustments(organization_id);
CREATE INDEX IF NOT EXISTS idx_finance_bill_adj_bill_id ON finance.bill_adjustments(bill_id);
CREATE INDEX IF NOT EXISTS idx_finance_bill_adj_at ON finance.bill_adjustments(adjusted_at);
CREATE INDEX IF NOT EXISTS idx_finance_payment_rev_org_id ON finance.payment_reversals(organization_id);
CREATE INDEX IF NOT EXISTS idx_finance_payment_rev_payment_id ON finance.payment_reversals(original_payment_id);
CREATE INDEX IF NOT EXISTS idx_finance_payment_rev_bill_id ON finance.payment_reversals(bill_id);
CREATE INDEX IF NOT EXISTS idx_finance_payment_rev_status ON finance.payment_reversals(status);
CREATE INDEX IF NOT EXISTS idx_finance_payment_rev_at ON finance.payment_reversals(reversed_at);
