-- Fail rows where fixed calendar week fields are inconsistent.

SELECT
    date_day,
    fixed_calendar_week_start,
    fixed_calendar_week_end,
    fixed_calendar_week_id
FROM {{ ref('dim_time') }}
WHERE fixed_calendar_week_start > date_day
   OR fixed_calendar_week_end < date_day
   OR datediff('day', fixed_calendar_week_start, fixed_calendar_week_end) <> 6
   OR fixed_calendar_week_start <> (date_day - (day_of_week * INTERVAL 1 DAY))::DATE
   OR fixed_calendar_week_id <> CAST(strftime(date_day, '%G%V') AS INTEGER)
