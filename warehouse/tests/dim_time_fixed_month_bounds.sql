-- Fail rows where fixed calendar month fields are inconsistent.

SELECT
    date_day,
    month_start,
    fixed_calendar_month_start,
    fixed_calendar_month_end,
    fixed_calendar_month_id
FROM {{ ref('dim_time') }}
WHERE fixed_calendar_month_start <> date_trunc('month', date_day)::DATE
   OR fixed_calendar_month_end <> (date_trunc('month', date_day)::DATE + INTERVAL 1 MONTH - INTERVAL 1 DAY)::DATE
   OR month_start <> fixed_calendar_month_start
   OR fixed_calendar_month_id <> CAST(strftime(date_day, '%Y%m') AS INTEGER)
