# Realtime Diagnostic & Testing Guide

## Current Situation

- ✅ Driver authentication is working (Driver@{employee_id} password pattern)
- ✅ Driver has valid Supabase session with JWT token
- ❌ Realtime subscriptions timeout and do NOT receive updates

## Step 1: Run Database Diagnostics

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Run the diagnostic script: [supabase/DIAGNOSE_REALTIME.sql](supabase/DIAGNOSE_REALTIME.sql)
4. Review the output for any ❌ errors

Expected output should show:
- ✅ `tasks`, `task_assignees`, `driver_breaks` in supabase_realtime publication
- ✅ All three tables have replica identity = 'full'
- ✅ All drivers have auth accounts
- ✅ RLS policies exist for authenticated users

## Step 2: Check Supabase Project Settings

### Critical Settings to Verify:

1. **Realtime Service Status**
   - Go to: Dashboard → Project Settings → API
   - Check: Is "Enable Realtime" toggle ON?
   - Check: Max simultaneous connections (should be > 0)

2. **Project Region & Connectivity**
   - Go to: Dashboard → Settings → General
   - Note the project region
   - Verify the project URL matches what's in your `.env` files

3. **Database Extensions**
   - Go to: Dashboard → Database → Extensions
   - Verify these extensions are enabled:
     - `pg_cron` (optional)
     - `pgcrypto` (required for auth)
     - Any other extensions your old project had

## Step 3: Check Environment Variables

Verify these are correct in your deployment:

```bash
# In your .env or Vercel environment variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Important:** Make sure these match your NEW Supabase project, not the old one.

## Step 4: Test Realtime in Supabase Dashboard

You can test Realtime directly in Supabase without any code:

1. Go to: Dashboard → Table Editor → tasks table
2. Open browser console (F12)
3. Paste this test code:

```javascript
// Get your project details from Dashboard → Settings → API
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// Create a Supabase client
const { createClient } = supabase;
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Subscribe to changes
const channel = client
  .channel('test-tasks-channel')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tasks'
  }, (payload) => {
    console.log('✅ REALTIME WORKING! Received:', payload);
  })
  .subscribe((status, err) => {
    console.log('Subscription status:', status, err);
    if (status === 'SUBSCRIBED') {
      console.log('✅ Successfully subscribed to tasks table');
    } else if (status === 'TIMED_OUT') {
      console.error('❌ Subscription TIMED OUT - Realtime is not working!');
    }
  });

// Wait 30 seconds, then:
// - If you see "SUBSCRIBED" → Realtime service is working
// - If you see "TIMED_OUT" → Realtime service is disabled or has issues
//
// After successful subscription, update a task in the table editor
// You should see a console log immediately
```

## Step 5: Compare with Working Admin Realtime

The admin TasksBoard.tsx has working realtime. Let's compare:

**Admin Code (WORKS):**
```typescript
const channel = client
  .channel('admin-tasks-board')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, handleRealtimeEvent)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, handleRealtimeEvent)
  .subscribe();
```

**Driver Code (DOESN'T WORK):**
```typescript
const channelName = `driver-tasks-${Date.now()}`;
const channel = client
  .channel(channelName)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, ...)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, ...)
  .subscribe((status, err) => { ... });
```

**Key Question:** Does admin realtime work in your new Supabase project? If admin works but driver doesn't, it's an auth/RLS issue. If neither works, it's a Realtime service configuration issue.

## Step 6: Test Admin Realtime

1. Login as admin
2. Open browser console
3. Check for realtime subscription logs
4. Create a new task
5. Does the board update immediately without refresh?

**If admin works but driver doesn't:**
- This is an RLS policy or auth issue
- Check the diagnostic script output for RLS policies
- Verify drivers have SELECT permission on tasks/task_assignees

**If neither admin nor driver works:**
- This is a Realtime service configuration issue
- Check Project Settings → API → Realtime enabled
- Contact Supabase support or check their status page

## Step 7: Common Fixes

### Fix 1: Realtime Service Not Enabled
```
Dashboard → Project Settings → API
Toggle "Enable Realtime" to ON
```

### Fix 2: Missing Websocket Support
Some hosting providers (like Cloudflare) can interfere with websockets. Check:
- Are you using any proxies/CDN in front of your app?
- Try accessing the app directly without proxy
- Check browser network tab for websocket connection attempts

### Fix 3: RLS Policies Missing for Driver Role
Run this SQL if drivers can't read tasks:

```sql
-- Grant realtime access to drivers
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees;

-- Verify RLS policies allow driver SELECT
SELECT * FROM pg_policies
WHERE tablename IN ('tasks', 'task_assignees')
  AND cmd = 'SELECT';
```

### Fix 4: Browser/Network Issues
- Try in incognito mode (rules out extensions)
- Try on different network (rules out firewall)
- Check browser console for CORS or websocket errors
- Clear browser cache and localStorage

## Step 8: If Nothing Works

If you've tried everything and Realtime still doesn't work:

1. **Export the diagnostic report:**
   - Run DIAGNOSE_REALTIME.sql and save output
   - Export browser console logs
   - Note your Supabase project region/plan

2. **Compare old vs new project:**
   - Did old project have a paid plan with Realtime?
   - Is new project on free tier with Realtime limits?
   - Check Supabase pricing page for Realtime availability

3. **Contact Supabase Support:**
   - Include diagnostic report
   - Mention: "Realtime worked in old project, doesn't work in new project"
   - Provide both project refs for comparison

## Expected Console Logs When Working

```
✅ Driver authenticated with Supabase - Realtime enabled
✅ [DriverHome] Driver has valid auth session: {user_id}
✅ [DriverHome] Successfully subscribed to realtime updates
[DriverHome] tasks change received, refreshing...
```

## Current Console Logs (Not Working)

```
✅ Driver authenticated with Supabase - Realtime enabled
✅ [DriverHome] Driver has valid auth session: 205d2782-625c-4193-9cc8-15d69a577a43
⚠️ [DriverHome] Subscription TIMED_OUT
[DriverHome] Retrying subscription...
⚠️ [DriverHome] Subscription TIMED_OUT (after retry)
```

This indicates the Supabase Realtime service itself is not responding to subscription requests, which is a project-level configuration issue, not a code issue.
