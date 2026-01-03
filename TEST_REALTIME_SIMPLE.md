# Simple Realtime Test

The migration is applied but realtime still times out. Let's test step by step.

## Step 1: Verify RLS Policies Are Fixed

Run in Supabase SQL Editor:
```sql
SELECT
  policyname,
  pg_get_expr(qual, 'public.tasks'::regclass) as policy_expression
FROM pg_policies
WHERE tablename = 'tasks' AND cmd = 'SELECT';
```

**Expected output:** The policy should NOT contain `app_user_role()`. It should have inline `EXISTS` queries.

If it STILL shows `app_user_role()`, then the migration didn't actually replace the policy.

## Step 2: Manually Drop and Recreate Policy (If Needed)

If the policy still uses `app_user_role()`, run this manually:

```sql
-- Drop the old policy
DROP POLICY IF EXISTS tasks_select_role_based ON public.tasks;
DROP POLICY IF EXISTS task_assignees_select_role_based ON public.task_assignees;

-- Create new realtime-friendly policy for tasks
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

-- Create new realtime-friendly policy for task_assignees
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
```

## Step 3: Restart Everything

1. **Restart Supabase project** (if available): Dashboard → Settings → General → Restart Project
2. **Kill your Next.js dev server**: Ctrl+C
3. **Clear browser data**:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   ```
4. **Restart dev server**: `npm run dev`
5. **Re-login as driver**

## Step 4: Check Supabase Realtime Settings

1. Go to: **Supabase Dashboard → Project Settings → API**
2. Scroll to **Realtime** section
3. Verify:
   - "Enable Realtime" is toggled **ON**
   - Check if there are connection limits
   - Note the Realtime URL

## Step 5: Test with Simple Subscription

In browser console after driver login:

```javascript
// Test realtime subscription
const testChannel = window.supabase
  .channel('test-' + Date.now())
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tasks'
  }, (payload) => {
    console.log('✅ REALTIME WORKS! Received:', payload);
  })
  .subscribe((status, err) => {
    console.log('📡 Subscription status:', status);
    if (status === 'SUBSCRIBED') {
      console.log('✅ SUCCESS! Realtime is working!');
    } else if (status === 'TIMED_OUT') {
      console.error('❌ STILL TIMING OUT');
      console.error('Error:', err);
    }
  });

// Wait 30 seconds for subscription
// Then test by updating a task in admin panel
```

## Step 6: Check Postgres Logs

If still not working, check Supabase logs:
1. Dashboard → Logs → Postgres Logs
2. Filter for "realtime" or "publication"
3. Look for errors related to RLS or permissions

## Possible Root Causes If Still Failing

1. **Supabase project plan**: Free tier might have Realtime restrictions
2. **Firewall/Network**: Something blocking websocket connections
3. **Supabase service issue**: Realtime service might be degraded
4. **Policy caching**: Postgres might be caching the old policy

## Nuclear Option: Disable RLS Temporarily (Testing Only!)

```sql
-- ⚠️ DANGEROUS - TESTING ONLY!
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees DISABLE ROW LEVEL SECURITY;
```

If realtime works with RLS disabled, then it's definitely an RLS policy issue.

**Don't forget to re-enable:**
```sql
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
```
