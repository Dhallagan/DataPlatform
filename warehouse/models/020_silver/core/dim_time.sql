-- =============================================================================
-- DIMENSION: Time (Dynamic)
-- =============================================================================
-- Grain: 1 row per day
-- Purpose: canonical time dimension for fixed calendar joins and rolling windows
-- Source: GENERATE_SERIES using project start_date / end_date vars
-- =============================================================================

WITH date_spine AS (
    SELECT UNNEST(
        GENERATE_SERIES(
            DATE '{{ var("start_date") }}',
            DATE '{{ var("end_date") }}',
            INTERVAL 1 DAY
        )
    )::DATE AS date_day
),

final AS (
    SELECT
        date_day,
        CAST(REPLACE(date_day::TEXT, '-', '') AS INTEGER) AS date_id,

        -- Fixed calendar week (Monday-based ISO week)
        DATE_TRUNC('week', date_day)::DATE AS fixed_calendar_week_start,
        (DATE_TRUNC('week', date_day) + INTERVAL '6 days')::DATE AS fixed_calendar_week_end,
        CAST(YEARWEEK(date_day) AS INTEGER) AS fixed_calendar_week_id,

        -- Month
        DATE_TRUNC('month', date_day)::DATE AS month_start,
        DATE_TRUNC('month', date_day)::DATE AS fixed_calendar_month_start,
        (DATE_TRUNC('month', date_day) + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS fixed_calendar_month_end,
        CAST(EXTRACT(YEAR FROM date_day) * 100 + EXTRACT(MONTH FROM date_day) AS INTEGER) AS fixed_calendar_month_id,

        -- Quarter / Year
        DATE_TRUNC('quarter', date_day)::DATE AS quarter_start,
        DATE_TRUNC('year', date_day)::DATE AS year_start,
        EXTRACT(YEAR FROM date_day)::INTEGER AS year_number,
        EXTRACT(MONTH FROM date_day)::INTEGER AS month_number,
        EXTRACT(DAY FROM date_day)::INTEGER AS day_of_month,
        EXTRACT(DOW FROM date_day)::INTEGER AS day_of_week,
        CASE WHEN EXTRACT(DOW FROM date_day) IN (0, 6) THEN TRUE ELSE FALSE END AS is_weekend,

        -- Rolling windows
        (date_day - INTERVAL '6 days')::DATE AS rolling_7d_start,
        date_day AS rolling_7d_end,
        (date_day - INTERVAL '27 days')::DATE AS rolling_28d_start,
        date_day AS rolling_28d_end,

        CURRENT_TIMESTAMP AS _loaded_at
    FROM date_spine
)

SELECT * FROM final
