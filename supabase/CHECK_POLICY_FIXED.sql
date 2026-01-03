-- Check if the RLS policy was actually fixed
-- Run this in Supabase SQL Editor

SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  CASE
    WHEN qual::text LIKE '%app_user_role%' THEN '❌ STILL USES app_user_role() - NOT FIXED!'
    WHEN qual::text LIKE '%EXISTS%' THEN '✅ Uses EXISTS - FIXED'
    ELSE '⚠️ Other'
  END as status,
  qual::text as policy_definition
FROM pg_policies
WHERE tablename IN ('tasks', 'task_assignees')
  AND schemaname = 'public'
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;
