-- @name getPgBossLastRun
SELECT completed_on
FROM pgboss.job
WHERE name = $1
  AND state = 'completed'
ORDER BY completed_on DESC
LIMIT 1;
