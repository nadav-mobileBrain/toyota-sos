-- Query to verify Realtime is properly configured
-- Run this to check if tables are published for realtime

-- Check which tables are in the realtime publication
SELECT
  schemaname,
  tablename,
  'Enabled' as realtime_status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN ('tasks', 'task_assignees', 'driver_breaks')
ORDER BY tablename;

-- Check replica identity for these tables (should be 'full' or 'default')
SELECT
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'd' THEN 'default (primary key)'
    WHEN 'n' THEN 'nothing'
    WHEN 'f' THEN 'full'
    WHEN 'i' THEN 'index'
  END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('tasks', 'task_assignees', 'driver_breaks')
ORDER BY c.relname;

-- If any tables are missing from the publication, the migration should have added them
-- If replica identity is not set correctly, run the migration again
