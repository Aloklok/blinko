-- @name listAttachmentsInFolder
WITH combined_items AS (
  SELECT DISTINCT ON (folder_name)
    NULL as id,
    CASE 
      WHEN path LIKE '/api/s3file/%' THEN '/api/s3file/'
      ELSE '/api/file/'
    END || split_part("perfixPath", ',', array_length(string_to_array($1, ','), 1) + 1) as path,
    split_part("perfixPath", ',', array_length(string_to_array($1, ','), 1) + 1) as name,
    NULL::decimal as size,
    NULL as type,
    false as "isShare",
    '' as "sharePassword",
    NULL::integer as "noteId",
    0::integer as "sortOrder",
    NULL::timestamp as "createdAt",
    NULL::timestamp as "updatedAt",
    true as is_folder,
    split_part("perfixPath", ',', array_length(string_to_array($1, ','), 1) + 1) as folder_name
  FROM attachments
  WHERE ("accountId" = $2)
    AND "perfixPath" LIKE $3
    AND array_length(string_to_array("perfixPath", ','), 1) > array_length(string_to_array($1, ','), 1)
  
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
  WHERE ("accountId" = $2)
    AND "perfixPath" = $1
)
SELECT *
FROM combined_items
ORDER BY is_folder DESC, "sortOrder" ASC, "updatedAt" DESC NULLS LAST
LIMIT $4
OFFSET $5;
