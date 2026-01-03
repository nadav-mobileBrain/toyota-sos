# Next Debugging Steps for Driver Realtime Issue

## Current Status

Driver 165 is still falling back to localStorage session instead of using Supabase auth session, which breaks realtime subscriptions.

## Step 1: Verify Driver 165 Has Auth Account

Run this SQL query in Supabase SQL Editor:

```sql
-- Check if driver 165 has an auth account
-- Copy this from: supabase/CHECK_DRIVER_165_AUTH.sql

SELECT
  p.id as profile_id,
  p.employee_id,
  p.email as profile_email,
  p.name,
  u.id as auth_id,
  u.email as auth_email,
  u.email_confirmed_at,
  u.last_sign_in_at
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.employee_id = '165' OR p.employee_id LIKE '%165%';
```

### Expected Result:
- `profile_id` should match `auth_id`
- `profile_email` should be something like `driver+165@toyota.local`
- `auth_email` should match `profile_email`
- `email_confirmed_at` should NOT be NULL

### If auth_id is NULL:
Driver 165 doesn't have an auth account. You need to:
1. Either re-run the migration: `supabase/migrations/20260103140000_create_driver_auth_accounts.sql`
2. Or manually create the auth account for driver 165

## Step 2: Test Login with Enhanced Logging

1. Clear browser localStorage and cookies
2. Open browser DevTools console
3. Login as driver with employee ID 165
4. Look for these NEW console logs:

```
[Auth] Attempting login for driver 165 (driver+165@toyota.local)...
[Auth] Using password: Driver@165
✅ Driver authenticated with Supabase - Realtime enabled
[Auth] Supabase session: { user_id: '...', email: 'driver+165@toyota.local', expires_at: '...' }
[Auth] Verify stored session: { user_id: '...', email: 'driver+165@toyota.local' }
```

### Then check getCurrentSession logs:

```
[getCurrentSession] Called - checking Supabase auth...
[getCurrentSession] Supabase session: { user_id: '...', email: 'driver+165@toyota.local' }
[getCurrentSession] Profile from Supabase: { role: 'driver', employee_id: '165', name: '...' }
✅ [getCurrentSession] Using Supabase driver session!
```

## Step 3: Interpret the Results

### Scenario A: signInWithPassword Returns "NO SESSION"
**Problem**: Auth account doesn't exist or password is wrong
**Solution**: Verify auth account exists (Step 1) and password matches pattern `Driver@165`

### Scenario B: signInWithPassword Returns Session, But "NO STORED SESSION"
**Problem**: Supabase client isn't persisting the session
**Solution**: This is a browser/storage issue - try:
- Clear all site data
- Disable browser extensions
- Try incognito mode
- Check browser console for storage errors

### Scenario C: Stored Session Exists, But getCurrentSession Finds "NO SESSION"
**Problem**: Timing issue - session is lost between login and AuthProvider check
**Solution**: This suggests a race condition or session is being cleared

### Scenario D: getCurrentSession Finds Session, But Falls Back to localStorage
**Problem**: The profile query is failing or returning null
**Solution**: Check the profile query logs and RLS policies

## Step 4: If Driver 165 Auth Account Is Missing

Run this SQL to manually create it:

```sql
-- Replace these values with actual data from profiles table
DO $$
DECLARE
  driver_profile_id uuid := (SELECT id FROM public.profiles WHERE employee_id = '165');
  driver_email text := 'driver+165@toyota.local';
  driver_password text := 'Driver@165';
BEGIN
  -- Create auth account
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    driver_profile_id,
    'authenticated',
    'authenticated',
    driver_email,
    crypt(driver_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('employee_id', '165', 'name', (SELECT name FROM public.profiles WHERE employee_id = '165')),
    now(),
    now()
  );

  -- Create identity
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    driver_profile_id,
    jsonb_build_object('sub', driver_profile_id::text, 'email', driver_email),
    'email',
    now(),
    now(),
    now()
  );

  RAISE NOTICE 'Created auth account for driver 165: %', driver_email;
END $$;
```

## Step 5: After Verifying Auth Account Exists

1. Restart Next.js dev server (Ctrl+C and `npm run dev`)
2. Clear browser localStorage, cookies, and site data
3. Login as driver 165
4. Check console logs for the new detailed output
5. Report back what the logs show

## What To Look For

The critical question is: **Does `signInWithPassword` return a session?**

If YES → Session persistence issue
If NO → Auth account missing or password wrong
