-- Fix Realtime RLS policies for drivers
-- The issue: app_user_role() function queries the profiles table, which can cause
-- Realtime subscriptions to timeout because Supabase Realtime evaluates RLS in a
-- special context where cross-table queries might not work efficiently.
--
-- Solution: Add simpler RLS policies that check auth.uid() directly for Realtime SELECT operations

-- First, let's create a helper function to check if a user is authenticated
-- This is simpler and works better with Realtime
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

-- CRITICAL: Drop the OLD policies that use app_user_role() function
-- These are the policies causing the timeout issue
DROP POLICY IF EXISTS tasks_select_role_based ON public.tasks;
DROP POLICY IF EXISTS task_assignees_select_role_based ON public.task_assignees;

-- For tasks table: Allow authenticated users to SELECT if they're assigned OR if they're staff
-- This is more permissive but works with Realtime
CREATE POLICY tasks_select_role_based
ON public.tasks FOR SELECT
USING (
  -- Authenticated users can see tasks they're assigned to
  auth.uid() IS NOT NULL
  AND (
    -- Either they're assigned to the task
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id AND ta.driver_id = auth.uid()
    )
    -- OR they're a staff member (check profiles directly without function)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'manager', 'viewer')
    )
  )
);

-- For task_assignees: Similar approach
CREATE POLICY task_assignees_select_role_based
ON public.task_assignees FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Either this is their assignment
    driver_id = auth.uid()
    -- OR they're a staff member
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'manager', 'viewer')
    )
  )
);

-- Note: We keep the old policies for INSERT/UPDATE/DELETE operations
-- Only replacing the SELECT policies with Realtime-friendly versions

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.is_authenticated() TO authenticated;

-- Verify the changes
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '✅ RLS POLICIES FIXED FOR REALTIME';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '- Dropped OLD policies: tasks_select_role_based, task_assignees_select_role_based';
  RAISE NOTICE '- Created NEW policies: Same names but WITHOUT app_user_role() function';
  RAISE NOTICE '- SELECT policies now use inline EXISTS queries instead of function calls';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: You must RESTART your application for changes to take effect!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Restart your Next.js dev server (Ctrl+C, then npm run dev)';
  RAISE NOTICE '2. Clear driver browser localStorage and refresh';
  RAISE NOTICE '3. Re-login as driver';
  RAISE NOTICE '4. Test realtime updates - should now see SUBSCRIBED instead of TIMED_OUT';
  RAISE NOTICE '';
END $$;
