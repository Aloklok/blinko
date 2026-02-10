-- @name searchAttachments
WITH combined_items AS (
  SELECT DISTINCT ON (folder_name)
    NULL as id,
    CASE 
      WHEN path LIKE '/api/s3file/%' THEN '/api/s3file/'
      ELSE '/api/file/'
    END || split_part("perfixPath", ',', 1) as path,
    split_part("perfixPath", ',', 1) as name,
    NULL::decimal as size,
    NULL as type,
    false as "isShare",
    '' as "sharePassword",
    NULL::integer as "noteId",
    0::integer as "sortOrder",
    NULL::timestamp as "createdAt",
    NULL::timestamp as "updatedAt",
    true as is_folder,
    split_part("perfixPath", ',', 1) as folder_name
  FROM attachments
  WHERE ("accountId" = $1)
    AND "perfixPath" != ''
    AND LOWER("perfixPath") LIKE $2
  
  UNION ALL
  
  SELECT 
    id,
    path,
    name,
    size,
    type,
    "isShare",
    "sharePassword",
    "noteId",
    "sortOrder",
    "createdAt",
    "updatedAt",
    false as is_folder,
    NULL as folder_name
  FROM attachments
  WHERE ("accountId" = $1)
    AND depth = 0
    AND LOWER(path) LIKE $2
)
SELECT *
FROM combined_items
ORDER BY is_folder DESC, "sortOrder" ASC, "updatedAt" DESC NULLS LAST
LIMIT $3
OFFSET $4;
