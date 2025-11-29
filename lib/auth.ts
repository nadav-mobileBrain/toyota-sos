import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User, Session } from '@supabase/supabase-js';

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

    // DEV convenience: attempt real Supabase sign-in so RLS works for RPC
    // We seeded driver01..05 with passwords Driver@202501..Driver@202505
    // Derive password from employeeId when possible (e.g., D0001 -> 01)
    if (row.email) {
      try {
        const lastTwo =
          String(row.employee_id || '')
            .replace(/\D/g, '')
            .slice(-2) || '01';
        const derivedPassword = `Driver@2025${lastTwo}`;
        const { error: authErr } = await client.auth.signInWithPassword({
          email: row.email,
          password: derivedPassword,
        });
        // If this fails (e.g., prod), we silently continue with local session fallback
        if (authErr) {
          console.warn(
            'Driver password sign-in failed (fallback to local session):',
            authErr.message
          );
        }
      } catch {
        // ignore
      }
    }

    // Create driver session
    const session: DriverSession = {
      employeeId: row.employee_id || upper,
      userId: row.id,
      role: 'driver',
      name: row.name,
      createdAt: Date.now(),
    };

    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(DRIVER_SESSION_KEY, JSON.stringify(session));
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
 * Logout driver (clear localStorage session)
 */
export const logoutDriver = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DRIVER_SESSION_KEY);
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

    // Get user role from metadata
    const role = (data.user?.user_metadata?.role as string) || 'viewer';
    if (role !== 'admin' && role !== 'viewer') {
      await client.auth.signOut();
      return {
        success: false,
        error: 'User does not have admin or viewer access',
      };
    }

    const session: AdminSession = {
      userId: data.user.id,
      username: username,
      role: role as 'admin' | 'viewer',
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
 */
export const getAdminSession = async (
  client: SupabaseClient
): Promise<AdminSession | null> => {
  try {
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) return null;

    const role = (user.user_metadata?.role as string) || 'viewer';
    return {
      userId: user.id,
      username: user.email || '',
      role: role as 'admin' | 'viewer',
      email: user.email,
    };
  } catch {
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
  // Check for driver session first (driver can't also be admin)
  const driverSession = getDriverSession();
  if (driverSession) return driverSession;

  // Check for admin session
  return await getAdminSession(client);
};

/**
 * Get current user role
 */
export const getCurrentRole = async (
  client: SupabaseClient
): Promise<'driver' | 'admin' | 'manager' | 'viewer' | null> => {
  const session = await getCurrentSession(client);
  return session?.role || null;
};

/**
 * Unified logout for either driver or admin
 */
export const logout = async (client: SupabaseClient): Promise<void> => {
  // Always clear local driver session (noop if none)
  logoutDriver();
  // Always sign out Supabase (noop if no admin session)
  try {
    await logoutAdmin(client);
  } catch {
    // ignore; best-effort
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
