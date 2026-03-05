-- Fail rows where rolling window bounds are not aligned to date_day.

SELECT
    date_day,
    rolling_7d_start,
    rolling_7d_end,
    rolling_28d_start,
    rolling_28d_end
FROM {{ ref('dim_time') }}
WHERE rolling_7d_end <> date_day
   OR rolling_28d_end <> date_day
   OR datediff('day', rolling_7d_start, rolling_7d_end) <> 6
   OR datediff('day', rolling_28d_start, rolling_28d_end) <> 27
