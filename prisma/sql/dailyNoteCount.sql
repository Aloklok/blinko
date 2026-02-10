-- @name dailyNoteCount
SELECT 
  to_char("createdAt"::date, 'YYYY-MM-DD') as date,
  COUNT(*) as count
FROM "notes"
WHERE "accountId" = $1
  AND "createdAt" >= NOW() - INTERVAL '1 year'
GROUP BY "createdAt"::date
ORDER BY "createdAt"::date ASC;
