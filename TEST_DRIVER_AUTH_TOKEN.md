# Test Driver Auth Token Structure

## Problem
- Admin realtime works (email/password login)
- Driver realtime DOESN'T work (employee_id → signInWithPassword login)
- Both have valid Supabase sessions
- This suggests a JWT token structure or claims issue

## Test: Compare JWT Tokens

### Step 1: Get Admin JWT Token

1. Login as admin
2. Open browser console
3. Run:
```javascript
const { data } = await window.supabase.auth.getSession();
const adminToken = data.session.access_token;
console.log('Admin Token:', adminToken);

// Decode JWT (it's base64 encoded)
const [header, payload, signature] = adminToken.split('.');
const decodedPayload = JSON.parse(atob(payload));
console.log('Admin JWT Payload:', JSON.stringify(decodedPayload, null, 2));
```

### Step 2: Get Driver JWT Token

1. Login as driver (e.g., employee_id 184)
2. Open browser console
3. Run the same code:
```javascript
const { data } = await window.supabase.auth.getSession();
const driverToken = data.session.access_token;
console.log('Driver Token:', driverToken);

const [header, payload, signature] = driverToken.split('.');
const decodedPayload = JSON.parse(atob(payload));
console.log('Driver JWT Payload:', JSON.stringify(decodedPayload, null, 2));
```

### Step 3: Compare the Payloads

Look for differences in these fields:
- `role` - Should be "authenticated" for both
- `aud` - Should be "authenticated" for both
- `iss` - Should match your Supabase project URL
- `sub` - The user ID
- `email` - Driver should have `driver+{employee_id}@toyota.local`
- `app_metadata` - Check if both have similar structure
- `user_metadata` - Check if both have similar structure

## Expected Issue: Role Mismatch

If the JWT tokens are different, it could be:

### Issue 1: Wrong `role` in JWT
```json
// Admin (works)
{
  "role": "authenticated",
  "aud": "authenticated"
}

// Driver (doesn't work)
{
  "role": "anon",  // ❌ WRONG!
  "aud": "authenticated"
}
```

**Fix:** The migration script needs to ensure drivers are created with role="authenticated"

### Issue 2: Missing `app_metadata`
```json
// Admin (works)
{
  "app_metadata": {
    "provider": "email",
    "providers": ["email"]
  }
}

// Driver (doesn't work)
{
  "app_metadata": {}  // ❌ EMPTY!
}
```

**Fix:** The migration script already sets this, so this shouldn't be the issue

### Issue 3: Email Confirmation Status
```json
// Admin (works)
{
  "email_confirmed_at": "2026-01-03T00:00:00Z"
}

// Driver (doesn't work)
{
  "email_confirmed_at": null  // ❌ NOT CONFIRMED!
}
```

**Fix:** Ensure `email_confirmed_at` is set in the migration

## Step 4: Check If It's an RLS Issue

If JWT tokens look identical, then it's an RLS policy issue. Run this SQL:

```sql
-- Check RLS policies for tasks table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  CASE
    WHEN qual::text LIKE '%auth.uid()%' THEN 'Uses auth.uid() ✅'
    WHEN qual::text LIKE '%auth.email()%' THEN 'Uses auth.email() ⚠️'
    ELSE 'Other filter'
  END as auth_check,
  qual as row_filter
FROM pg_policies
WHERE tablename IN ('tasks', 'task_assignees')
  AND schemaname = 'public'
  AND cmd = 'SELECT'
ORDER BY tablename, policyname;
```

### Common RLS Issues:

1. **Policy checks `auth.email() LIKE '%@company.com'`** - This would fail for `driver+157@toyota.local`
2. **Policy checks specific email domains** - Drivers use `@toyota.local` which might be blocked
3. **Policy requires specific role in JWT** - Check if policy uses `(auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'`

## Step 5: Test Realtime with Specific Filter

Try subscribing with a filter to see if RLS is the issue:

```javascript
// In driver's browser console
const channel = window.supabase
  .channel(`test-${Date.now()}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tasks',
    filter: `id=eq.${someTaskId}`  // Replace with actual task ID
  }, (payload) => {
    console.log('Received update:', payload);
  })
  .subscribe((status) => {
    console.log('Status:', status);
  });

// Wait 10 seconds
// If SUBSCRIBED → RLS allows subscription
// If TIMED_OUT → RLS is blocking or Realtime service issue
```

## Step 6: Check Supabase Realtime Inspector

1. Go to: Supabase Dashboard → Database → Replication
2. Check if `tasks` and `task_assignees` are listed
3. Check "Realtime Inspector" logs for connection attempts
4. Look for error messages when driver tries to subscribe

## Most Likely Causes

Based on "admin works, driver doesn't":

1. **JWT role mismatch** (driver has `role: "anon"` instead of `role: "authenticated"`)
2. **RLS policy uses email domain check** that blocks `@toyota.local` emails
3. **RLS policy checks user_metadata role** expecting "admin" but driver has "driver"
4. **Email not confirmed** - Driver accounts have `email_confirmed_at: null`

## Quick Fix to Test

If you suspect it's an RLS issue, temporarily disable RLS on tasks table:

```sql
-- ⚠️ DANGEROUS - Only for testing!
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees DISABLE ROW LEVEL SECURITY;

-- Test driver realtime
-- If it works now → RLS was the issue

-- Re-enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
```

**Do NOT leave RLS disabled in production!**

## Next Steps Based on Results

1. **If JWT tokens are different** → Fix the migration script
2. **If RLS is blocking** → Fix the RLS policies to allow driver accounts
3. **If tokens and RLS are fine** → Contact Supabase support (might be a Realtime service bug)
