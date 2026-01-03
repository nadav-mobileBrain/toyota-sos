-- Check current RLS policies for tasks and task_assignees
-- Run this in Supabase SQL Editor to see what policies are active

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  CASE
    WHEN pg_get_expr(qual, (schemaname || '.' || tablename)::regclass) LIKE '%app_user_role%'
    THEN '❌ USES app_user_role() - PROBLEMATIC'
    ELSE '✅ Does not use app_user_role()'
  END as policy_check,
  pg_get_expr(qual, (schemaname || '.' || tablename)::regclass) as row_filter_expression
FROM pg_policies
WHERE tablename IN ('tasks', 'task_assignees')
  AND schemaname = 'public'
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;
