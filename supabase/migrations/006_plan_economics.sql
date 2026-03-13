-- =============================================================================
-- PLAN ECONOMICS SCHEMA
-- =============================================================================
-- Adds a time-bounded plan economics table for expected cost assumptions.
-- =============================================================================

CREATE TABLE IF NOT EXISTS plan_economics (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id                     UUID NOT NULL REFERENCES plans(id),
    expected_cost_per_hour_usd  NUMERIC(10, 4) NOT NULL CHECK (expected_cost_per_hour_usd >= 0),
    effective_start             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_end               TIMESTAMPTZ,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW(),
    CHECK (effective_end IS NULL OR effective_end > effective_start),
    UNIQUE(plan_id, effective_start)
);

CREATE INDEX IF NOT EXISTS idx_plan_economics_plan_id
    ON plan_economics(plan_id);

CREATE INDEX IF NOT EXISTS idx_plan_economics_effective_window
    ON plan_economics(effective_start, effective_end);
