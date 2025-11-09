import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User, Session } from '@supabase/supabase-js';

// Determine which environment to use (default to PROD)
const ENV = process.env.NEXT_PUBLIC_ENVIRONMENT || 'PROD';

// Get environment variables (these are optional at build time, required at runtime)
const getSupabaseUrl = (): string => {
  const url =
    process.env[`NEXT_PUBLIC_SUPABASE_URL_${ENV.toUpperCase()}`] ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error(
      `Missing Supabase URL. Please set NEXT_PUBLIC_SUPABASE_URL_${ENV.toUpperCase()} in .env.local`
    );
  }
  return url;
};

const getSupabaseAnonKey = (): string => {
  const key =
    process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${ENV.toUpperCase()}`] ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      `Missing Supabase Anon Key. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY_${ENV.toUpperCase()} in .env.local`
    );
  }
  return key;
};

const getServiceRoleKey = (): string | undefined => {
  return (
    process.env[`SUPABASE_SERVICE_ROLE_KEY_${ENV.toUpperCase()}`] ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

let SUPABASE_URL: string;
let SUPABASE_ANON_KEY: string;
let SUPABASE_SERVICE_ROLE_KEY: string | undefined;

// Only load if not during build
if (typeof window !== 'undefined' || process.env.NODE_ENV === 'production') {
  SUPABASE_URL = getSupabaseUrl();
  SUPABASE_ANON_KEY = getSupabaseAnonKey();
  SUPABASE_SERVICE_ROLE_KEY = getServiceRoleKey();
}

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
  role: 'admin' | 'viewer';
  email?: string;
}

export type AuthSession = DriverSession | AdminSession | null;

// Browser client (client-side only)
export const createBrowserClient = (): SupabaseClient => {
  const url = SUPABASE_URL || getSupabaseUrl();
  const key = SUPABASE_ANON_KEY || getSupabaseAnonKey();
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
  const url = SUPABASE_URL || getSupabaseUrl();
  const key = SUPABASE_ANON_KEY || getSupabaseAnonKey();
  return createClient(url, key, {
    auth: {
      persistSession: false,
    },
  });
};

// Service role client (admin operations, server-only)
export const createServiceRoleClient = (): SupabaseClient => {
  const serviceKey = SUPABASE_SERVICE_ROLE_KEY || getServiceRoleKey();
  if (!serviceKey) {
    throw new Error('Service role key is required for admin operations');
  }

  const url = SUPABASE_URL || getSupabaseUrl();
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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
    // Query profiles table for this employee
    const { data, error } = await client
      .from('profiles')
      .select('id, name, role, employee_id')
      .eq('employee_id', employeeId)
      .eq('role', 'driver')
      .single();

    if (error || !data) {
      return {
        success: false,
        error: 'Employee ID not found or not a driver',
      };
    }

    // Create driver session
    const session: DriverSession = {
      employeeId: employeeId,
      userId: data.id,
      role: 'driver',
      name: data.name,
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
export const getCurrentSession = async (client: SupabaseClient): Promise<AuthSession> => {
  // Check for driver session first (driver can't also be admin)
  const driverSession = getDriverSession();
  if (driverSession) return driverSession;

  // Check for admin session
  return await getAdminSession(client);
};

/**
 * Get current user role
 */
export const getCurrentRole = async (client: SupabaseClient): Promise<'driver' | 'admin' | 'viewer' | null> => {
  const session = await getCurrentSession(client);
  return session?.role || null;
};

/**
 * Unified logout for either driver or admin
 */
export const logout = async (client: SupabaseClient): Promise<void> => {
  const driverSession = getDriverSession();

  if (driverSession) {
    logoutDriver();
  } else {
    await logoutAdmin(client);
  }
};

/**
 * Format auth error message
 */
export const getAuthError = (error: any): string => {
  if (!error) return 'An unknown error occurred';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.error_description) return error.error_description;
  return 'An error occurred during authentication';
};
