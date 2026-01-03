-- CRITICAL CHECKS FOR REALTIME
-- Run these queries in Supabase SQL Editor and share the results

-- 1. Check if realtime extension exists
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'realtime';

-- 2. Check all publications
SELECT pubname, pubowner, puballtables, pubinsert, pubupdate, pubdelete
FROM pg_publication;

-- 3. Check tables in supabase_realtime publication
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 4. Check replica identity for our tables
SELECT
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'd' THEN 'default'
    WHEN 'f' THEN 'full'
    WHEN 'n' THEN 'nothing'
  END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('tasks', 'task_assignees')
ORDER BY c.relname;

-- 5. Check if Realtime is actually enabled in the database
SELECT * FROM pg_stat_replication;

-- 6. Check realtime schema exists
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name = 'realtime';
