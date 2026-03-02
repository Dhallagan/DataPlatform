-- Fail when a queued task has no corresponding action log row.
SELECT
    q.task_id,
    q.signal_id
FROM {{ ref('growth_task_queue') }} q
LEFT JOIN {{ ref('action_log') }} a
  ON a.task_id = q.task_id
 AND a.signal_id = q.signal_id
WHERE a.task_id IS NULL
