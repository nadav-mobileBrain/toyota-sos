# Realtime Subscription Fix for Drivers

## Problem

Drivers were unable to receive realtime updates from Supabase. The error `TIMED_OUT` appeared in console logs when drivers tried to subscribe to task changes.

## Root Cause

**PRIMARY ISSUE:** The RLS policies use a custom `app_user_role()` function that queries the `profiles` table. Supabase Realtime evaluates RLS policies in a special context where cross-table function calls can cause subscription timeouts.

**SECONDARY ISSUE (FIXED):** Drivers were logging in with only their employee_id, which created a localStorage-only session without proper Supabase authentication. This has been fixed - drivers now authenticate via `signInWithPassword`.

**Why admin works but driver doesn't:** Admin users likely access tasks through direct queries, while the Realtime subscription's RLS evaluation hits the timeout when evaluating the `app_user_role()` function for each event.

## Solution

### 1. Fix RLS Policies for Realtime (NEW - CRITICAL!)

**Migration:** [supabase/migrations/20260103200000_fix_realtime_rls_for_drivers.sql](supabase/migrations/20260103200000_fix_realtime_rls_for_drivers.sql)

The `app_user_role()` function queries the `profiles` table, which causes Realtime subscription timeouts. The fix:
- Replaces SELECT policies with inline `EXISTS` queries instead of function calls
- Checks `auth.uid()` directly against `profiles.role` within the policy
- Keeps INSERT/UPDATE/DELETE policies unchanged (they don't affect Realtime)

```sql
-- Before (causes timeout)
using ( app_user_role() = 'admin'::role OR ... )

-- After (works with Realtime)
using (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM task_assignees WHERE driver_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'viewer'))
  )
)
```

### 2. Updated Driver Authentication ([lib/auth.ts](lib/auth.ts#L254-L305))

Modified the `loginAsDriver` function to:
- **Require** proper Supabase authentication for drivers
- Return clear error messages if authentication fails
- No longer silently fall back to localStorage-only sessions

### 3. Created Database Migration for Driver Auth

Run the migration to create Supabase auth accounts for all drivers:

```bash
# Apply both migrations to your Supabase project
supabase db push
```

Or manually apply:
1. [supabase/migrations/20260103140000_create_driver_auth_accounts.sql](supabase/migrations/20260103140000_create_driver_auth_accounts.sql)
2. [supabase/migrations/20260103200000_fix_realtime_rls_for_drivers.sql](supabase/migrations/20260103200000_fix_realtime_rls_for_drivers.sql) ← **CRITICAL FIX**

This migration:
- Creates Supabase auth accounts for all existing drivers
- Uses existing emails or generates them in the pattern: `driver+{employee_id}@toyota.local`
- Sets passwords in the pattern: `Driver@{employee_id}`
  - Example: employee_id "157" → `driver+157@toyota.local` with password `Driver@157`
  - Example: employee_id "269" → `driver+269@toyota.local` with password `Driver@269`

### 4. Enhanced Error Logging ([components/driver/DriverHome.tsx](components/driver/DriverHome.tsx#L426-L501))

Added diagnostic logging to help identify realtime subscription issues:
- Checks for valid Supabase auth session before subscribing
- Provides clear console messages when subscription fails
- Includes actionable error messages pointing to the solution

## Testing the Fix

1. **Run the migration** in your new Supabase project:
   ```bash
   supabase db push
   ```

2. **Clear browser storage** for testing:
   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   ```

3. **Login as a driver** using their employee_id (e.g., `D0001`)

4. **Check console logs** - you should see:
   ```
   ✅ Driver authenticated with Supabase - Realtime enabled
   ✅ [DriverHome] Driver has valid auth session: {user_id}
   ✅ [DriverHome] Successfully subscribed to realtime updates
   ```

5. **Test realtime updates**:
   - Login as admin in another browser/tab
   - Create a new task or change task status
   - Driver should see the update immediately without refresh

## What Changed

### Before
```
Driver Login → localStorage session only → No Supabase auth → Realtime TIMED_OUT ❌
```

### After
```
Driver Login → Supabase auth + localStorage → Valid JWT token → Realtime works ✅
```

## Production Deployment Checklist

- [ ] **Run BOTH migrations on production Supabase project** (auth + RLS fix)
- [ ] Verify all drivers have email addresses in profiles table
- [ ] Test driver login with a few accounts
- [ ] Monitor console logs for realtime subscription status - should see `SUBSCRIBED` not `TIMED_OUT`
- [ ] Verify RLS policies are updated: Run `SELECT * FROM pg_policies WHERE tablename = 'tasks' AND policyname LIKE '%realtime%'`
- [ ] Consider implementing password reset flow for drivers (future enhancement)

## Email & Password Pattern Reference

The migration uses these patterns:
- **Email**: `driver+{numeric_employee_id}@toyota.local`
  - Example: employee_id "157" → `driver+157@toyota.local`
  - Example: employee_id "269" → `driver+269@toyota.local`
- **Password**: `Driver@{numeric_employee_id}`
  - Example: employee_id "157" → `Driver@157`
  - Example: employee_id "269" → `Driver@269`

## Troubleshooting

### Issue: Driver still seeing TIMED_OUT error
**Solution:**
1. Check if migration ran successfully
2. Verify driver has an email in profiles table
3. Check Supabase auth users table for the driver's account
4. Clear browser localStorage and try logging in again

### Issue: Login fails with "אימות נכשל"
**Solution:**
1. Verify driver has Supabase auth account: `SELECT * FROM auth.users WHERE email = 'driver+{employee_id}@toyota.local'`
2. Re-run the migration to create missing accounts
3. Check password matches the pattern: `Driver@{employee_id}` (e.g., for employee 157: `Driver@157`)

### Issue: Realtime works but RPC calls fail
**Solution:**
- Check Row Level Security (RLS) policies on tables
- Verify `get_driver_tasks` RPC function has correct permissions
- Check that driver's user_id matches between profiles and auth.users

## Additional Notes

- The existing migration [20260103130000_enable_realtime_tasks.sql](supabase/migrations/20260103130000_enable_realtime_tasks.sql) already enabled realtime for `tasks` and `task_assignees` tables
- Admin users were not affected because they always had proper Supabase authentication
- This fix maintains backward compatibility with the existing driver session system
