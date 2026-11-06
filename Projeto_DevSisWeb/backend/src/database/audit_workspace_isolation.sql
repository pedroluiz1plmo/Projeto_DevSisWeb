-- Read-only preflight for migrations 011/012. Save the output and make a
-- database backup before applying either migration.
SELECT 'characters' AS table_name,
       COUNT(*) AS record_count,
       MIN(created_at) AS oldest_record,
       MAX(created_at) AS newest_record
FROM characters
UNION ALL
SELECT 'campaigns', COUNT(*), MIN(created_at), MAX(created_at)
FROM campaigns
UNION ALL
SELECT 'folders', COUNT(*), MIN(created_at), MAX(created_at)
FROM folders
UNION ALL
SELECT 'campaign_members', COUNT(*), MIN(joined_at), MAX(joined_at)
FROM campaign_members
UNION ALL
SELECT 'campaign_characters', COUNT(*), MIN(joined_at), MAX(joined_at)
FROM campaign_characters
UNION ALL
SELECT 'character_dnd_5e', COUNT(*), MIN(created_at), MAX(created_at)
FROM character_dnd_5e
ORDER BY table_name;

SELECT filename, applied_at
FROM schema_migrations
WHERE filename IN ('011_add_workspace_types.sql', '012_preserve_unclassified_workspaces.sql');

SELECT table_name,
       COUNT(*) FILTER (WHERE column_name = 'workspace_type') > 0 AS has_workspace_type
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name IN (
    'characters',
    'campaigns',
    'folders',
    'campaign_members',
    'campaign_characters'
  )
GROUP BY table_name
ORDER BY table_name;
