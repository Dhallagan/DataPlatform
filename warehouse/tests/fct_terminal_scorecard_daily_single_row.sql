-- Ensure scorecard snapshot has exactly one row.
WITH counts AS (
    SELECT COUNT(*) AS row_count
    FROM {{ ref('fct_terminal_scorecard_daily') }}
)
SELECT row_count
FROM counts
WHERE row_count != 1
