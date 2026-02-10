-- @name randomNotes
SELECT *
FROM "notes"
WHERE "accountId" = $1
  AND "isArchived" = false
  AND "isRecycle" = false
ORDER BY RANDOM()
LIMIT $2;
