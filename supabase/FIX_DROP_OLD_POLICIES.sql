-- CRITICAL FIX: Drop all old policies that use app_user_role()
-- The migration created NEW policies but didn't remove the OLD ones
-- Postgres evaluates ALL policies, so the old ones are still causing timeouts

-- Drop the OLD problematic policies
DROP POLICY IF EXISTS task_assignees_select_role_based ON public.task_assignees;

-- Also drop any duplicate policies we created
DROP POLICY IF EXISTS tasks_select_realtime_friendly ON public.tasks;
DROP POLICY IF EXISTS task_assignees_select_realtime_friendly ON public.task_assignees;

-- Drop the weird "tasks_realtime_all_authenticated" policy (too permissive)
DROP POLICY IF EXISTS tasks_realtime_all_authenticated ON public.tasks;

-- Verify tasks_select_role_based is the good one (it should be using EXISTS now)
-- If it's still using is_admin_or_manager(), we need to drop and recreate it too
DO $$
DECLARE
  policy_def text;
BEGIN
  SELECT qual::text INTO policy_def
  FROM pg_policies
  WHERE tablename = 'tasks'
    AND policyname = 'tasks_select_role_based'
    AND schemaname = 'public';

  IF policy_def LIKE '%is_admin_or_manager%' OR policy_def LIKE '%app_user_role%' THEN
    RAISE NOTICE '⚠️  tasks_select_role_based still uses helper function - recreating...';

    DROP POLICY IF EXISTS tasks_select_role_based ON public.tasks;

    CREATE POLICY tasks_select_role_based
    ON public.tasks FOR SELECT
    USING (
      auth.uid() IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.task_assignees ta
          WHERE ta.task_id = tasks.id AND ta.driver_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'manager', 'viewer')
        )
      )
    );

    RAISE NOTICE '✅ Recreated tasks_select_role_based without helper function';
  ELSE
    RAISE NOTICE '✅ tasks_select_role_based is already fixed';
  END IF;
END $$;

-- Now create the correct policy for task_assignees (since we dropped the old one)
CREATE POLICY task_assignees_select_role_based
ON public.task_assignees FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'manager', 'viewer')
    )
  )
);

-- Verify the cleanup
DO $$
DECLARE
  bad_policies int;
BEGIN
  SELECT COUNT(*) INTO bad_policies
  FROM pg_policies
  WHERE tablename IN ('tasks', 'task_assignees')
    AND schemaname = 'public'
    AND cmd = 'SELECT'
    AND (qual::text LIKE '%app_user_role%' OR qual::text LIKE '%is_admin_or_manager%');

  IF bad_policies > 0 THEN
    RAISE NOTICE '❌ Still have % policies using helper functions', bad_policies;
  ELSE
    RAISE NOTICE '✅ All policies cleaned up!';
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'REALTIME FIX COMPLETE';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Restart your Next.js dev server';
    RAISE NOTICE '2. Clear browser localStorage';
    RAISE NOTICE '3. Re-login as driver';
    RAISE NOTICE '4. Realtime should now work!';
  END IF;
END $$;
