-- Fail when a successful action row carries an error message
-- or a failed row is missing an error message.
SELECT
    action_id,
    status,
    error_message
FROM {{ ref('action_log') }}
WHERE (status = 'success' AND error_message IS NOT NULL)
   OR (status = 'failed' AND error_message IS NULL)
