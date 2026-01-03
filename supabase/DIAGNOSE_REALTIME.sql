-- Comprehensive Realtime Diagnostic Script
-- Run this in the Supabase SQL Editor to diagnose Realtime issues

\echo '========================================='
\echo 'SUPABASE REALTIME DIAGNOSTIC REPORT'
\echo '========================================='
\echo ''

\echo '1. CHECKING REALTIME PUBLICATION...'
\echo '-----------------------------------'
-- Check if supabase_realtime publication exists
SELECT
  pubname as publication_name,
  puballtables as all_tables_enabled,
  pubinsert as insert_enabled,
  pubupdate as update_enabled,
  pubdelete as delete_enabled
FROM pg_publication
WHERE pubname = 'supabase_realtime';

\echo ''
\echo '2. CHECKING PUBLISHED TABLES...'
\echo '-------------------------------'
-- Check which tables are in the realtime publication
SELECT
  schemaname,
  tablename,
  'Enabled ✅' as realtime_status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
ORDER BY tablename;

\echo ''
\echo '3. CHECKING REPLICA IDENTITY...'
\echo '-------------------------------'
-- Check replica identity for critical tables (should be 'full' or 'default')
SELECT
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'd' THEN 'default (primary key)'
    WHEN 'n' THEN 'nothing ❌ - WILL NOT WORK'
    WHEN 'f' THEN 'full ✅'
    WHEN 'i' THEN 'index'
  END as replica_identity,
  CASE
    WHEN c.relreplident IN ('d', 'f') THEN '✅ OK'
    ELSE '❌ NEEDS FIX'
  END as status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('tasks', 'task_assignees', 'driver_breaks')
ORDER BY c.relname;

\echo ''
\echo '4. CHECKING RLS POLICIES FOR REALTIME...'
\echo '----------------------------------------'
-- Check if RLS policies exist for tasks (required for realtime with auth)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as row_filter
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('tasks', 'task_assignees', 'driver_breaks')
ORDER BY tablename, policyname;

\echo ''
\echo '5. CHECKING DRIVER AUTH ACCOUNTS...'
\echo '-----------------------------------'
-- Check if drivers have proper auth accounts
SELECT
  p.employee_id,
  p.name,
  CASE
    WHEN u.id IS NOT NULL THEN '✅ Has auth account'
    ELSE '❌ Missing auth account'
  END as auth_status,
  u.email as auth_email,
  CASE
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Confirmed'
    ELSE '❌ Not confirmed'
  END as email_confirmed,
  u.last_sign_in_at
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE p.role = 'driver'
ORDER BY p.employee_id
LIMIT 10;

\echo ''
\echo '6. CHECKING REALTIME SCHEMA ACCESS...'
\echo '-------------------------------------'
-- Check if realtime schema exists and has proper permissions
SELECT
  nspname as schema_name,
  nspowner::regrole as owner,
  'Exists ✅' as status
FROM pg_namespace
WHERE nspname = 'realtime';

\echo ''
\echo '7. SUMMARY & RECOMMENDATIONS...'
\echo '-------------------------------'
DO $$
DECLARE
  missing_tables int;
  wrong_identity int;
  missing_auth int;
BEGIN
  -- Count missing tables
  SELECT 3 - COUNT(*) INTO missing_tables
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename IN ('tasks', 'task_assignees', 'driver_breaks');

  -- Count tables with wrong replica identity
  SELECT COUNT(*) INTO wrong_identity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('tasks', 'task_assignees', 'driver_breaks')
    AND c.relreplident NOT IN ('d', 'f');

  -- Count drivers without auth
  SELECT COUNT(*) INTO missing_auth
  FROM public.profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  WHERE p.role = 'driver'
    AND u.id IS NULL;

  RAISE NOTICE '';
  RAISE NOTICE '=== DIAGNOSTIC SUMMARY ===';
  RAISE NOTICE 'Missing tables from publication: %', missing_tables;
  RAISE NOTICE 'Tables with wrong replica identity: %', wrong_identity;
  RAISE NOTICE 'Drivers without auth accounts: %', missing_auth;
  RAISE NOTICE '';

  IF missing_tables > 0 THEN
    RAISE NOTICE '❌ ACTION REQUIRED: Run migration 20260103130000_enable_realtime_tasks.sql';
  END IF;

  IF wrong_identity > 0 THEN
    RAISE NOTICE '❌ ACTION REQUIRED: Fix replica identity (see migration above)';
  END IF;

  IF missing_auth > 0 THEN
    RAISE NOTICE '❌ ACTION REQUIRED: Run migration 20260103140000_create_driver_auth_accounts.sql';
  END IF;

  IF missing_tables = 0 AND wrong_identity = 0 AND missing_auth = 0 THEN
    RAISE NOTICE '✅ All checks passed! Realtime should be working.';
    RAISE NOTICE '';
    RAISE NOTICE 'If Realtime still does not work, check:';
    RAISE NOTICE '1. Supabase Dashboard → Project Settings → API → Realtime enabled?';
    RAISE NOTICE '2. Network/firewall blocking websocket connections?';
    RAISE NOTICE '3. Browser console for additional errors?';
    RAISE NOTICE '4. Try in incognito mode to rule out browser extensions?';
  END IF;
END $$;

\echo ''
\echo '========================================='
\echo 'END OF DIAGNOSTIC REPORT'
\echo '========================================='
