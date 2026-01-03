-- Full Realtime Debug Query
-- Run this in Supabase SQL Editor to diagnose the realtime issue

\echo '1. CHECK REALTIME PUBLICATION'
\echo '==============================='
SELECT
  pubname,
  puballtables,
  pubinsert,
  pubupdate,
  pubdelete
FROM pg_publication
WHERE pubname = 'supabase_realtime';

\echo ''
\echo '2. CHECK PUBLISHED TABLES'
\echo '=========================='
SELECT
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
ORDER BY tablename;

\echo ''
\echo '3. CHECK REPLICA IDENTITY'
\echo '=========================='
SELECT
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'd' THEN 'default'
    WHEN 'f' THEN 'full'
    WHEN 'n' THEN 'nothing'
    ELSE 'other'
  END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('tasks', 'task_assignees')
ORDER BY c.relname;

\echo ''
\echo '4. CHECK SELECT POLICIES FOR TASKS'
\echo '===================================='
SELECT
  policyname,
  permissive,
  roles,
  pg_get_expr(qual, 'public.tasks'::regclass) as using_expression
FROM pg_policies
WHERE tablename = 'tasks'
  AND schemaname = 'public'
  AND cmd = 'SELECT';

\echo ''
\echo '5. CHECK SELECT POLICIES FOR TASK_ASSIGNEES'
\echo '============================================='
SELECT
  policyname,
  permissive,
  roles,
  pg_get_expr(qual, 'public.task_assignees'::regclass) as using_expression
FROM pg_policies
WHERE tablename = 'task_assignees'
  AND schemaname = 'public'
  AND cmd = 'SELECT';

\echo ''
\echo '6. TEST IF DRIVER CAN SELECT TASKS'
\echo '===================================='
\echo 'Run this as the driver user to test RLS:'
\echo 'SELECT COUNT(*) FROM tasks;'
