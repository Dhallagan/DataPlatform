-- =============================================================================
-- Scenario: Mid-Month Downgrade Overage Leakage
-- =============================================================================
-- Purpose:
--   Reproduce the bug where a current-state billing export misses pre-downgrade
--   usage when an organization downgrades in the middle of a billing month.
--
-- How to use:
--   1) Run this in Supabase SQL editor (or psql against the source DB).
--   2) Run: python3 pipeline/replicate.py
--   3) Run: cd warehouse && dbt run --select stg_usage_records vw_customer_usage_billing_export
--   4) Query fin.vw_customer_usage_billing_export for organization_slug='leak-labs-sim'
-- =============================================================================

BEGIN;

-- Stable IDs for repeatable reruns.
-- Organization: 11111111-1111-1111-1111-111111111111
-- Starter sub:  22222222-2222-2222-2222-222222222222
-- Free sub:     33333333-3333-3333-3333-333333333333

INSERT INTO organizations (
    id,
    name,
    slug,
    stripe_customer_id,
    billing_email,
    status,
    created_at,
    updated_at
)
VALUES (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Leak Labs',
    'leak-labs-sim',
    'cus_LEAKLABSSIM0001',
    'billing@leaklabs.example',
    'active',
    '2026-01-01 00:00:00+00',
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    billing_email = EXCLUDED.billing_email,
    status = EXCLUDED.status,
    updated_at = NOW();

-- Clear previous scenario subscriptions so reruns are deterministic.
DELETE FROM subscriptions
WHERE organization_id = '11111111-1111-1111-1111-111111111111'::uuid;

WITH plan_ids AS (
    SELECT
        MAX(CASE WHEN name = 'starter' THEN id END) AS starter_plan_id,
        MAX(CASE WHEN name = 'free' THEN id END) AS free_plan_id
    FROM plans
)
INSERT INTO subscriptions (
    id,
    organization_id,
    plan_id,
    status,
    stripe_subscription_id,
    trial_ends_at,
    current_period_start,
    current_period_end,
    canceled_at,
    created_at,
    updated_at
)
SELECT
    '22222222-2222-2222-2222-222222222222'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    starter_plan_id,
    'canceled',
    'sub_LEAKLABS_STARTER',
    NULL,
    '2026-02-01 00:00:00+00'::timestamptz,
    '2026-02-14 23:59:59+00'::timestamptz,
    '2026-02-15 00:00:00+00'::timestamptz,
    '2026-02-01 00:00:00+00'::timestamptz,
    NOW()
FROM plan_ids
UNION ALL
SELECT
    '33333333-3333-3333-3333-333333333333'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    free_plan_id,
    'active',
    'sub_LEAKLABS_FREE',
    NULL,
    '2026-02-15 00:00:00+00'::timestamptz,
    '2026-03-14 23:59:59+00'::timestamptz,
    NULL,
    '2026-02-15 00:00:00+00'::timestamptz,
    NOW()
FROM plan_ids;

-- Remove existing scenario sessions for a clean rerun.
DELETE FROM browser_sessions
WHERE organization_id = '11111111-1111-1111-1111-111111111111'::uuid
  AND created_at::date BETWEEN DATE '2026-02-01' AND DATE '2026-02-28';

-- First half of month: heavy usage on starter (1,100 sessions).
INSERT INTO browser_sessions (
    id,
    organization_id,
    status,
    started_at,
    ended_at,
    pages_visited,
    bytes_downloaded,
    bytes_uploaded,
    created_at,
    updated_at
)
SELECT
    (
        SUBSTRING(md5('leak-pre-' || g::text), 1, 8) || '-' ||
        SUBSTRING(md5('leak-pre-' || g::text), 9, 4) || '-' ||
        SUBSTRING(md5('leak-pre-' || g::text), 13, 4) || '-' ||
        SUBSTRING(md5('leak-pre-' || g::text), 17, 4) || '-' ||
        SUBSTRING(md5('leak-pre-' || g::text), 21, 12)
    )::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'completed',
    ('2026-02-01 00:00:00+00'::timestamptz + ((g - 1) % 14) * INTERVAL '1 day' + ((g - 1) % 24) * INTERVAL '1 hour'),
    ('2026-02-01 00:05:00+00'::timestamptz + ((g - 1) % 14) * INTERVAL '1 day' + ((g - 1) % 24) * INTERVAL '1 hour'),
    10,
    500000,
    50000,
    ('2026-02-01 00:00:00+00'::timestamptz + ((g - 1) % 14) * INTERVAL '1 day' + ((g - 1) % 24) * INTERVAL '1 hour'),
    NOW()
FROM generate_series(1, 1100) AS gs(g);

-- Second half of month after downgrade to free: only 80 sessions.
INSERT INTO browser_sessions (
    id,
    organization_id,
    status,
    started_at,
    ended_at,
    pages_visited,
    bytes_downloaded,
    bytes_uploaded,
    created_at,
    updated_at
)
SELECT
    (
        SUBSTRING(md5('leak-post-' || g::text), 1, 8) || '-' ||
        SUBSTRING(md5('leak-post-' || g::text), 9, 4) || '-' ||
        SUBSTRING(md5('leak-post-' || g::text), 13, 4) || '-' ||
        SUBSTRING(md5('leak-post-' || g::text), 17, 4) || '-' ||
        SUBSTRING(md5('leak-post-' || g::text), 21, 12)
    )::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'completed',
    ('2026-02-15 00:00:00+00'::timestamptz + ((g - 1) % 14) * INTERVAL '1 day' + ((g - 1) % 24) * INTERVAL '1 hour'),
    ('2026-02-15 00:05:00+00'::timestamptz + ((g - 1) % 14) * INTERVAL '1 day' + ((g - 1) % 24) * INTERVAL '1 hour'),
    10,
    400000,
    40000,
    ('2026-02-15 00:00:00+00'::timestamptz + ((g - 1) % 14) * INTERVAL '1 day' + ((g - 1) % 24) * INTERVAL '1 hour'),
    NOW()
FROM generate_series(1, 80) AS gs(g);

-- Billing record remains period-level.
INSERT INTO usage_records (
    id,
    organization_id,
    subscription_id,
    period_start,
    period_end,
    sessions_count,
    session_minutes,
    bytes_downloaded,
    bytes_uploaded,
    proxy_requests,
    created_at,
    updated_at
)
VALUES (
    '44444444-4444-4444-4444-444444444444'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    DATE '2026-02-01',
    DATE '2026-02-28',
    1180,
    5900,
    582000000,
    58200000,
    0,
    '2026-03-01 00:00:00+00'::timestamptz,
    NOW()
)
ON CONFLICT (organization_id, period_start, period_end) DO UPDATE SET
    subscription_id = EXCLUDED.subscription_id,
    sessions_count = EXCLUDED.sessions_count,
    session_minutes = EXCLUDED.session_minutes,
    bytes_downloaded = EXCLUDED.bytes_downloaded,
    bytes_uploaded = EXCLUDED.bytes_uploaded,
    proxy_requests = EXCLUDED.proxy_requests,
    updated_at = NOW();

COMMIT;
