import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User, Session } from '@supabase/supabase-js';

// Determine which environment to use
const ENV = process.env.NEXT_PUBLIC_ENVIRONMENT || 'prod';
const SUPABASE_URL =
  process.env[`NEXT_PUBLIC_SUPABASE_URL_${ENV.toUpperCase()}`] ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY_${ENV.toUpperCase()}`] ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env[`SUPABASE_SERVICE_ROLE_KEY_${ENV.toUpperCase()}`] ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!SUPABASE_URL) {
  throw new Error(
    `Missing Supabase URL. Please set NEXT_PUBLIC_SUPABASE_URL${
      ENV !== 'prod' ? `_${ENV.toUpperCase()}` : ''
    }`
  );
}

if (!SUPABASE_ANON_KEY) {
  throw new Error(
    `Missing Supabase Anon Key. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY${
      ENV !== 'prod' ? `_${ENV.toUpperCase()}` : ''
    }`
  );
}

// Browser client (client-side only)
export const createBrowserClient = (): SupabaseClient => {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
};

// Server client (server-side only, with cookies support for Next.js)
export const createServerClient = (cookieStore?: any): SupabaseClient => {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
    },
  });
};

// Service role client (admin operations, server-only)
export const createServiceRoleClient = (): SupabaseClient => {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Service role key is required for admin operations');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

// Helper functions
export const getSession = async (client: SupabaseClient): Promise<Session | null> => {
  const {
    data: { session },
  } = await client.auth.getSession();
  return session;
};

export const getCurrentUser = async (client: SupabaseClient): Promise<User | null> => {
  const {
    data: { user },
  } = await client.auth.getUser();
  return user;
};

export const signIn = async (client: SupabaseClient, email: string, password: string) => {
  return await client.auth.signInWithPassword({ email, password });
};

export const signUp = async (
  client: SupabaseClient,
  email: string,
  password: string,
  metadata?: Record<string, any>
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

export const getAuthError = (error: any): string => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.error_description) return error.error_description;
  return 'An error occurred';
};
