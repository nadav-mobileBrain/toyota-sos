import { createClient } from '@supabase/supabase-js';
import type {
  SupabaseClient,
  User,
  Session,
  AuthError,
} from '@supabase/supabase-js';

// Client-side: Get config from window.__SUPABASE_CONFIG__ (injected by SupabaseConfigProvider)
const getSupabaseConfigBrowser = () => {
  if (typeof window !== 'undefined' && window.__SUPABASE_CONFIG__) {
    return {
      url: window.__SUPABASE_CONFIG__.url,
      key: window.__SUPABASE_CONFIG__.key,
    };
  }

  throw new Error('Supabase config not available on client');
};

// Server-side: Get config from process.env
const getSupabaseConfigServer = () => {
  const env = process.env.NEXT_PUBLIC_ENVIRONMENT || 'PROD';

  const url =
    process.env[`NEXT_PUBLIC_SUPABASE_URL_${env.toUpperCase()}`] ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${env.toUpperCase()}`] ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      `Missing Supabase URL. Please set NEXT_PUBLIC_SUPABASE_URL_${env.toUpperCase()} in .env.local`
    );
  }

  if (!key) {
    throw new Error(
      `Missing Supabase Anon Key. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY_${env.toUpperCase()} in .env.local`
    );
  }

  return { url, key };
};

// Choose appropriate config getter based on runtime
const getSupabaseConfig = () => {
  return typeof window !== 'undefined'
    ? getSupabaseConfigBrowser()
    : getSupabaseConfigServer();
};

// Session storage key for driver sessions (localStorage)
const DRIVER_SESSION_KEY = 'driver_session';

// Types for our hybrid auth system
export interface DriverSession {
  employeeId: string;
  userId: string;
  role: 'driver';
  name?: string;
  createdAt: number;
}

export interface AdminSession {
  userId: string;
  username: string;
  role: 'admin' | 'manager' | 'viewer';
  email?: string;
}

export type AuthSession = DriverSession | AdminSession | null;

// Browser client (client-side only)
export const createBrowserClient = (): SupabaseClient => {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
};

// Server client (server-side only)
export const createServerClient = (): SupabaseClient => {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key, {
    auth: {
      persistSession: false,
    },
  });
};

// Service role client (admin operations, server-only)
export const createServiceRoleClient = (): SupabaseClient => {
  // Service role only used on the server
  const { url } = getSupabaseConfigServer();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error('Service role key is required for admin operations');
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

// Helper functions
export const getSession = async (
  client: SupabaseClient
): Promise<Session | null> => {
  const {
    data: { session },
  } = await client.auth.getSession();
  return session;
};

/**
 * Timeout helper for async operations
 */
export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => {
        console.warn(`Operation timed out after ${ms}ms, using fallback`);
        resolve(fallback);
      }, ms);
    }),
  ]);
};

/**
 * Read cookie by name (browser only)
 */
export const readCookie = (name: string): string | null => {
  if (typeof window === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) return match[2];
  return null;
};

export const getCurrentUser = async (
  client: SupabaseClient
): Promise<User | null> => {
  const {
    data: { user },
  } = await client.auth.getUser();
  return user;
};

export const signIn = async (
  client: SupabaseClient,
  email: string,
  password: string
) => {
  return await client.auth.signInWithPassword({ email, password });
};

export const signUp = async (
  client: SupabaseClient,
  email: string,
  password: string,
  metadata?: Record<string, unknown>
) => {
  return await client.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });
};

export const signOut = async (client: SupabaseClient) => {
  return await client.auth.signOut();
};

// ============================================
// DRIVER AUTHENTICATION (Employee ID only)
// ============================================

/**
 * Login as driver using employee ID
 * Queries the profiles table to verify the employee exists and is a driver
 * Creates a local session stored in localStorage
 */
export const loginAsDriver = async (
  client: SupabaseClient,
  employeeId: string
): Promise<{ success: boolean; session?: DriverSession; error?: string }> => {
  try {
    const trimmed = (employeeId || '').trim();
    const upper = trimmed.toUpperCase();
    const candidateIds: string[] = Array.from(
      new Set<string>(
        [
          trimmed,
          upper,
          // If purely digits, also add D + zero-padded
          /^\d{1,6}$/.test(trimmed) ? `D${trimmed.padStart(4, '0')}` : '',
          // If D + digits (any pad), also add zero-padded D#### form
          /^D\d{1,6}$/i.test(trimmed)
            ? `D${trimmed.replace(/^D/i, '').padStart(4, '0')}`
            : '',
        ].filter(Boolean) as string[]
      )
    );

    // Query profiles table for this employee
    const { data, error } = await client
      .from('profiles')
      .select('id, name, role, employee_id, email')
      .in('employee_id', candidateIds)
      .eq('role', 'driver')
      .limit(1);

    if (error) {
      return {
        success: false,
        error: error?.message || 'Failed to verify employee ID',
      };
    }

    // Define shape of the expected row
    interface ProfileRow {
      id: string;
      name: string;
      role: string;
      employee_id: string;
      email: string | null;
    }

    const row = (data as unknown as ProfileRow[])?.[0];
    if (!row) {
      return {
        success: false,
        error: 'לא נמצא נהג במערכת',
      };
    }

    // Attempt real Supabase sign-in so RLS works for RPC AND Realtime works
    // Password pattern: Driver@{employee_id} (e.g., 157 -> Driver@157)
    if (row.email) {
      try {
        // Extract numeric employee_id (e.g., "157" from "157" or "D157")
        const numericId = String(row.employee_id || '').replace(/\D/g, '');
        if (!numericId) {
          console.error('❌ Invalid employee_id format:', row.employee_id);
          return {
            success: false,
            error: 'מזהה עובד לא תקין. אנא פנה למנהל המערכת',
          };
        }

        // Password is: Driver@{numeric_id} (e.g., Driver@157)
        const derivedPassword = `Driver@${numericId}`;

        console.log(`[Auth] Attempting login for driver ${row.employee_id} (${row.email})...`);
        console.log(`[Auth] Using password: Driver@${numericId}`);

        const { error: authErr, data } = await client.auth.signInWithPassword({
          email: row.email,
          password: derivedPassword,
        });

        // IMPORTANT: If this fails, realtime subscriptions won't work!
        // In production, you need to ensure all drivers have proper Supabase auth accounts
        if (authErr) {
          console.error(
            '❌ Driver password sign-in failed - Realtime subscriptions will not work!',
            authErr.message
          );
          console.error(
            '⚠️ Action required: Create Supabase auth account for driver:',
            row.email,
            'with password: Driver@' + numericId
          );
          return {
            success: false,
            error:
              'אימות נכשל. אנא פנה למנהל המערכת להגדרת חשבון המשתמש שלך',
          };
        } else {
          console.log(
            '✅ Driver authenticated with Supabase - Realtime enabled'
          );
          console.log('[Auth] Supabase session:', data.session ? {
            user_id: data.session.user.id,
            email: data.session.user.email,
            expires_at: data.session.expires_at
          } : 'NO SESSION');

          // Verify session was stored correctly
          const { data: { session: storedSession } } = await client.auth.getSession();
          console.log('[Auth] Verify stored session:', storedSession ? {
            user_id: storedSession.user.id,
            email: storedSession.user.email
          } : 'NO STORED SESSION - THIS IS THE PROBLEM!');
        }
      } catch (err) {
        console.error('Driver sign-in error:', err);
        return {
          success: false,
          error: 'שגיאה באימות. אנא נסה שוב',
        };
      }
    } else {
      // No email means no Supabase auth account - this won't work for realtime
      console.error(
        '❌ Driver has no email - cannot authenticate for Realtime subscriptions'
      );
      return {
        success: false,
        error: 'חשבון המשתמש לא מוגדר כראוי. אנא פנה למנהל המערכת',
      };
    }

    // Create driver session
    const session: DriverSession = {
      employeeId: row.employee_id || upper,
      userId: row.id,
      role: 'driver',
      name: row.name,
      createdAt: Date.now(),
    };

    // Store in localStorage and set cookies for fast session detection
    if (typeof window !== 'undefined') {
      localStorage.setItem(DRIVER_SESSION_KEY, JSON.stringify(session));
      // Set cookies so getCurrentSession can quickly skip getAdminSession for drivers
      document.cookie = `toyota_role=driver; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days
      document.cookie = `toyota_user_id=${row.id}; path=/; max-age=${60 * 60 * 24 * 7}`;
    }

    return { success: true, session };
  } catch (err) {
    return {
      success: false,
      error: getAuthError(err),
    };
  }
};

/**
 * Logout driver (clear localStorage session and cookies)
 */
export const logoutDriver = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DRIVER_SESSION_KEY);
    // Clear cookies
    document.cookie = 'toyota_role=; path=/; max-age=0';
    document.cookie = 'toyota_user_id=; path=/; max-age=0';
  }
};

/**
 * Get stored driver session from localStorage
 */
export const getDriverSession = (): DriverSession | null => {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(DRIVER_SESSION_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as DriverSession;
  } catch {
    return null;
  }
};

// ============================================
// ADMIN/OFFICE AUTHENTICATION (Username + Password)
// ============================================

/**
 * Login as admin/office user using username + password
 * Uses Supabase auth (username field in email)
 */
export const loginAsAdmin = async (
  client: SupabaseClient,
  username: string,
  password: string
): Promise<{ success: boolean; session?: AdminSession; error?: string }> => {
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: username, // Supabase auth doesn't support username, use email field
      password,
    });

    if (error || !data.session) {
      return {
        success: false,
        error: error?.message || 'Login failed',
      };
    }

    // Get user role from profiles table (source of truth)
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      await client.auth.signOut();
      return {
        success: false,
        error: 'User profile not found',
      };
    }

    const role = profile.role as 'admin' | 'manager' | 'viewer' | 'driver';

    if (role !== 'admin' && role !== 'manager' && role !== 'viewer') {
      await client.auth.signOut();
      return {
        success: false,
        error: 'User does not have admin, manager, or viewer access',
      };
    }

    const session: AdminSession = {
      userId: data.user.id,
      username: username,
      role: role as 'admin' | 'manager' | 'viewer',
      email: data.user.email,
    };

    return { success: true, session };
  } catch (err) {
    return {
      success: false,
      error: getAuthError(err),
    };
  }
};

/**
 * Logout admin user
 */
export const logoutAdmin = async (client: SupabaseClient): Promise<void> => {
  await client.auth.signOut();
};

/**
 * Get current admin session from Supabase
 * With timeout and logging
 */
export const getAdminSession = async (
  client: SupabaseClient
): Promise<AdminSession | null> => {
  try {
    console.log('Checking admin session...');

    // Check Supabase session with timeout (5s)
    const {
      data: { user },
    } = await withTimeout(client.auth.getUser(), 5000, {
      data: { user: null },
      error: {
        message: 'Timeout',
        code: 'TIMEOUT',
        details: '',
        hint: '',
        name: 'TimeoutError',
        status: 408,
        __isAuthError: true,
      } as unknown as AuthError,
    });

    if (!user) {
      console.log('No Supabase user found');
      return null;
    }

    console.log('Supabase user found:', user.id);

    // Get role from profiles table (source of truth) with timeout (3s)
    const { data: profile, error: profileError } = await withTimeout(
      Promise.resolve(
        client.from('profiles').select('role').eq('id', user.id).single()
      ),
      3000,
      {
        data: null,
        error: {
          message: 'Timeout',
          code: 'TIMEOUT',
          details: '',
          hint: '',
          name: 'TimeoutError',
        },
        count: null,
        status: 408,
        statusText: 'Timeout',
      }
    );

    if (profileError || !profile) {
      console.warn('Failed to fetch profile for user:', profileError?.message);
      return null;
    }

    console.log('Profile found, role:', profile.role);

    const role = profile.role as 'admin' | 'manager' | 'viewer' | 'driver';

    // Only return session for admin/manager/viewer roles
    if (role !== 'admin' && role !== 'manager' && role !== 'viewer') {
      return null;
    }

    return {
      userId: user.id,
      username: user.email || '',
      role: role as 'admin' | 'manager' | 'viewer',
      email: user.email,
    };
  } catch (err) {
    console.error('Error getting admin session:', err);
    return null;
  }
};

// ============================================
// UNIFIED SESSION HELPERS
// ============================================

/**
 * Get current session (either driver or admin)
 * Returns the first available session found
 */
export const getCurrentSession = async (
  client: SupabaseClient
): Promise<AuthSession> => {
  console.log('[getCurrentSession] Called - checking Supabase auth...');

  // CRITICAL: Check Supabase auth session FIRST!
  // This ensures realtime subscriptions work for authenticated users (including drivers)
  const { data: { session: supabaseSession } } = await client.auth.getSession();

  console.log('[getCurrentSession] Supabase session:', supabaseSession ? {
    user_id: supabaseSession.user.id,
    email: supabaseSession.user.email
  } : 'NO SESSION');

  if (supabaseSession) {
    // We have a valid Supabase auth session - use it!
    // This could be admin, manager, viewer, OR driver
    const { data: profile } = await client
      .from('profiles')
      .select('role, employee_id, name')
      .eq('id', supabaseSession.user.id)
      .single();

    console.log('[getCurrentSession] Profile from Supabase:', profile);

    if (profile) {
      if (profile.role === 'driver') {
        console.log('✅ [getCurrentSession] Using Supabase driver session!');
        return {
          userId: supabaseSession.user.id,
          employeeId: profile.employee_id,
          role: 'driver',
          name: profile.name,
          createdAt: Date.now(),
        };
      } else {
        // Admin/manager/viewer
        console.log(`✅ [getCurrentSession] Using Supabase ${profile.role} session!`);
        return {
          userId: supabaseSession.user.id,
          username: supabaseSession.user.email || '',
          role: profile.role as 'admin' | 'manager' | 'viewer',
          email: supabaseSession.user.email || '',
        };
      }
    }
  }

  // Fallback: Check for driver session in localStorage
  // This is only used if there's no Supabase session
  const driverSession = getDriverSession();
  if (driverSession) {
    console.log('⚠️ [getCurrentSession] Using local driver session (fallback) - Realtime will NOT work!');
    return driverSession;
  }

  // Check cookies (faster than Supabase call)
  const roleCookie = readCookie('toyota_role');
  const userIdCookie = readCookie('toyota_user_id');

  if (roleCookie && userIdCookie) {
    if (['admin', 'manager', 'viewer'].includes(roleCookie)) {
      console.log('Using cookie session (fallback)');
      return {
        userId: userIdCookie,
        username: 'Cookie Session',
        role: roleCookie as 'admin' | 'manager' | 'viewer',
        email: 'cookie@fallback',
      };
    }
  }

  return null;
};

/**
 * Get current user role
 */
export const getCurrentRole = async (
  client: SupabaseClient
): Promise<'driver' | 'admin' | 'manager' | 'viewer' | null> => {
  const session = await getCurrentSession(client);
  if (session?.role) return session.role;

  // Extra fallback: check cookie directly if session is null
  const roleCookie = readCookie('toyota_role');
  if (
    roleCookie &&
    ['driver', 'admin', 'manager', 'viewer'].includes(roleCookie)
  ) {
    return roleCookie as 'driver' | 'admin' | 'manager' | 'viewer';
  }

  return null;
};

/**
 * Unified logout for either driver or admin
 */
export const logout = async (client: SupabaseClient): Promise<void> => {
  // Always clear local driver session (noop if none)
  logoutDriver();

  // Always sign out Supabase (noop if no admin session)
  // Add timeout to prevent hanging
  try {
    const signOutPromise = logoutAdmin(client);
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('SignOut timeout')), 2000)
    );

    await Promise.race([signOutPromise, timeoutPromise]);
  } catch (err) {
    // Ignore errors - local state is already cleared
    console.warn('Supabase signOut failed or timed out:', err);
  }
};

/**
 * Format auth error message
 */
export const getAuthError = (error: unknown): string => {
  if (!error) return 'An unknown error occurred';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const err = error as { message?: string; error_description?: string };
    if (err.message) return err.message;
    if (err.error_description) return err.error_description;
  }
  return 'An error occurred during authentication';
};
