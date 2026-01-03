# Debug: Why Driver Realtime Doesn't Work

## The Problem

Driver authentication succeeds (`✅ Driver authenticated with Supabase`) but realtime still times out.

## Root Cause

The Supabase client used for realtime subscription **doesn't have an active auth session**.

### Evidence from Console Logs

```
auth.ts:296 ✅ Driver authenticated with Supabase - Realtime enabled
DriverHome.tsx:442 ✅ [DriverHome] Driver has valid auth session: 954c8686-bd03-4e20-ab6d-9d35a31eb9f3
auth.ts:540 Using local driver session  ← THIS IS THE PROBLEM
DriverHome.tsx:479 [DriverHome] ⚠️ Subscription TIMED_OUT
```

When `getCurrentSession` is called, it returns the localStorage driver session instead of the Supabase auth session.

## The Flow

1. **Driver logs in** →  `loginAsDriver` in auth.ts
   - Calls `client.auth.signInWithPassword()` successfully
   - Supabase creates an auth session
   - ALSO creates localStorage session

2. **AuthProvider checks session** → `getCurrentSession(client)`
   - Sees localStorage driver session exists
   - Returns localStorage session **WITHOUT checking Supabase**
   - Supabase client thinks there's no auth!

3. **DriverHome tries realtime** → subscription with unauthenticated client
   - RLS policies require `auth.uid()` to be set
   - But Supabase client doesn't have active session
   - **TIMEOUT** because RLS blocks the subscription

## The Fix

We need to ensure that when a driver has authenticated via `signInWithPassword`, the Supabase client knows about it.

### Option 1: Don't use localStorage session for drivers (RECOMMENDED)

After successful `signInWithPassword`, rely entirely on Supabase's session management. Remove the localStorage session for drivers.

```typescript
// In loginAsDriver (auth.ts)
const { error: authErr, data } = await client.auth.signInWithPassword({
  email: row.email,
  password: derivedPassword,
});

if (!authErr && data.session) {
  // Don't create localStorage session - use Supabase session only
  return { success: true, session: {
    userId: data.session.user.id,
    employeeId: row.employee_id,
    role: 'driver',
    name: row.name,
    createdAt: Date.now()
  }};
}
```

Then update `getCurrentSession` to check Supabase session for drivers:

```typescript
export const getCurrentSession = async (client: SupabaseClient): Promise<AuthSession> => {
  // Check Supabase auth session first
  const { data: { session: supabaseSession } } = await client.auth.getSession();

  if (supabaseSession) {
    // Get profile to determine role
    const { data: profile } = await client
      .from('profiles')
      .select('role, employee_id, name')
      .eq('id', supabaseSession.user.id)
      .single();

    if (profile?.role === 'driver') {
      return {
        userId: supabaseSession.user.id,
        employeeId: profile.employee_id,
        role: 'driver',
        name: profile.name,
        createdAt: Date.now()
      };
    }

    // Admin/manager/viewer
    return {
      userId: supabaseSession.user.id,
      username: supabaseSession.user.email || '',
      role: profile?.role as any,
      email: supabaseSession.user.email || ''
    };
  }

  // Fallback to localStorage driver session (for backward compatibility)
  const driverSession = getDriverSession();
  if (driverSession) {
    console.log('Using local driver session');
    return driverSession;
  }

  return null;
};
```

### Option 2: Sync localStorage with Supabase auth events

Listen to Supabase auth state changes and update localStorage accordingly.

### Option 3: Remove localStorage session entirely

Just use Supabase sessions for everyone. Simpler and more reliable.

## Test to Confirm

Run this in driver's browser console after login:

```javascript
// Check if Supabase has a session
const { data } = await window.supabase.auth.getSession();
console.log('Supabase session:', data.session);

// If null → That's the problem!
// If has session → Something else is wrong
```

## Why It Worked 2 Days Ago

2 days ago, drivers were using localStorage-only sessions with NO Supabase authentication.
Realtime worked because either:
1. RLS was not enabled/enforced
2. Realtime didn't check RLS for unauthenticated users
3. Different RLS policies that allowed anonymous access

After adding proper driver authentication and fixing RLS policies, we broke the session management.
