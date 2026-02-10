-- @name monthlyWordStats
SELECT 
  to_char("createdAt", 'YYYY-MM') as month,
  SUM(LENGTH(content)) as count
FROM "notes"
WHERE "accountId" = $1
  AND "createdAt" >= $2
GROUP BY 1
ORDER BY 1 ASC;
