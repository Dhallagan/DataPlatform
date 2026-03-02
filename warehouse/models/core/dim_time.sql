-- =============================================================================
-- DIMENSION: Time
-- =============================================================================
-- Grain: 1 row per day
-- Purpose: canonical time dimension for date/month joins
-- =============================================================================

WITH spine AS (
    SELECT
        date_day::DATE AS date_day
    FROM generate_series(
        CAST('{{ var("start_date") }}' AS DATE),
        CAST('{{ var("end_date") }}' AS DATE),
        INTERVAL 1 DAY
    ) AS t(date_day)
)

SELECT
    date_day,
    DATE_TRUNC('month', date_day)::DATE AS month_start,
    DATE_TRUNC('quarter', date_day)::DATE AS quarter_start,
    DATE_TRUNC('year', date_day)::DATE AS year_start,
    EXTRACT(year FROM date_day)::INTEGER AS year_number,
    EXTRACT(month FROM date_day)::INTEGER AS month_number,
    EXTRACT(day FROM date_day)::INTEGER AS day_of_month,
    EXTRACT(dow FROM date_day)::INTEGER AS day_of_week,
    CASE WHEN EXTRACT(dow FROM date_day) IN (0, 6) THEN TRUE ELSE FALSE END AS is_weekend,
    CURRENT_TIMESTAMP AS _loaded_at
FROM spine
