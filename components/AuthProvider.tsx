'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  createBrowserClient,
  getCurrentSession,
  getCurrentRole,
  logout,
  loginAsDriver,
  loginAsAdmin,
  AuthSession,
} from '@/lib/auth';

interface AuthContextType {
  session: AuthSession;
  loading: boolean;
  error: string | null;
  client: SupabaseClient;
  role: 'driver' | 'admin' | 'manager' | 'viewer' | null;
  loginDriver: (
    employeeId: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginAdmin: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<
    'driver' | 'admin' | 'manager' | 'viewer' | null
  >(null);
  const [client, setClient] = useState<SupabaseClient | null>(null);

  const writeAuthCookies = (
    newRole: 'driver' | 'admin' | 'manager' | 'viewer' | null,
    userId: string | null = null
  ) => {
    try {
      if (!newRole) {
        // clear cookies
        document.cookie = `toyota_role=; path=/; max-age=0`;
        document.cookie = `toyota_user_id=; path=/; max-age=0`;
      } else {
        // 7 days
        const maxAge = 7 * 24 * 60 * 60;
        document.cookie = `toyota_role=${newRole}; path=/; max-age=${maxAge}`;
        if (userId) {
          document.cookie = `toyota_user_id=${userId}; path=/; max-age=${maxAge}`;
        }
      }
    } catch {
      // ignore
    }
  };

  // Initialize Supabase client and session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('AuthProvider: Initializing...');

      // FAST LOAD: Check localStorage first for full session data
      try {
        const storedSession = localStorage.getItem('driver_session');
        if (storedSession) {
          try {
            const parsedSession = JSON.parse(storedSession);
            console.log('AuthProvider: Found stored driver session, using it immediately');
            setSession(parsedSession);
            setRole('driver');
            setLoading(false); // Unblock UI immediately with real data
          } catch (parseErr) {
            console.warn('Failed to parse stored session:', parseErr);
          }
        } else {
          // Fallback to cookie-based optimistic load if no localStorage
          const roleCookie = document.cookie
            .split('; ')
            .find((row) => row.startsWith('toyota_role='))
            ?.split('=')[1];

          const userIdCookie = document.cookie
            .split('; ')
            .find((row) => row.startsWith('toyota_user_id='))
            ?.split('=')[1];

          if (
            roleCookie &&
            userIdCookie &&
            ['admin', 'manager', 'viewer', 'driver'].includes(roleCookie)
          ) {
            console.log('AuthProvider: Optimistic cookie found, unblocking UI');
            const typedRole = roleCookie as
              | 'driver'
              | 'admin'
              | 'manager'
              | 'viewer';
            setRole(typedRole);

            if (typedRole === 'driver') {
              setSession({
                userId: userIdCookie,
                employeeId: 'optimistic',
                role: 'driver',
                createdAt: Date.now(),
                name: 'Optimistic Driver',
              });
            } else {
              setSession({
                userId: userIdCookie,
                username: 'Optimistic Session',
                role: typedRole,
                email: 'optimistic@loading',
              });
            }
            setLoading(false);
          }
        }
      } catch (err) {
        console.warn('Fast load check failed:', err);
      }

      try {
        if (!client) {
          // Only if not already set by optimistic render (though it won't be in useEffect)
          setLoading(true);
        }

        // Create client first
        const supabaseClient = createBrowserClient();
        setClient(supabaseClient);
        console.log('AuthProvider: Client created');

        // Create a promise for the auth check
        const checkAuth = async () => {
          try {
            console.log('AuthProvider: Checking session...');
            const currentSession = await getCurrentSession(supabaseClient);
            console.log(
              'AuthProvider: Session result:',
              currentSession ? 'Found' : 'Null'
            );

            const currentRole = await getCurrentRole(supabaseClient);
            console.log('AuthProvider: Role result:', currentRole);

            return { session: currentSession, role: currentRole };
          } catch (e) {
            console.error('AuthProvider: Error in checkAuth:', e);
            throw e;
          }
        };

        // Race against a 5-second timeout for production reliability
        // If Supabase hangs completely, we force a fallback or clear state
        const { session: currentSession, role: currentRole } =
          await Promise.race([
            checkAuth(),
            new Promise<{ session: any; role: any }>((_, reject) =>
              setTimeout(
                () => reject(new Error('Auth initialization timed out')),
                5000
              )
            ),
          ]);

        // ALWAYS update with real session data (overwrite optimistic/localStorage data)
        if (currentSession) {
          console.log('AuthProvider: Got real session, replacing any optimistic data');
          setSession(currentSession);
          setRole(currentRole);
          writeAuthCookies(currentRole, currentSession?.userId || null);

          // Update localStorage for driver sessions
          if (currentRole === 'driver') {
            localStorage.setItem('driver_session', JSON.stringify(currentSession));
          }
        } else {
          // Only clear if we have no valid session
          console.log('AuthProvider: No valid session found');
          setSession(null);
          setRole(null);
          writeAuthCookies(null, null);
          localStorage.removeItem('driver_session');
        }
        setError(null);
        console.log('AuthProvider: Initialization complete');
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        console.error(
          'AuthProvider: Initialization failed/timed out:',
          errorMessage
        );

        // Final fallback: Keep localStorage/cookie session if auth check fails
        // This prevents users from being logged out on slow connections
        try {
          // Try localStorage first for drivers (has full session data)
          const storedSession = localStorage.getItem('driver_session');
          if (storedSession) {
            try {
              const parsedSession = JSON.parse(storedSession);
              console.warn('AuthProvider: Using stored session as fallback (auth timed out)');
              setSession(parsedSession);
              setRole('driver');
              // Keep existing cookies
            } catch {
              // Fall through to cookie check
            }
          }

          // Fallback to cookies if no localStorage
          if (!storedSession) {
            const roleCookie = document.cookie
              .split('; ')
              .find((row) => row.startsWith('toyota_role='))
              ?.split('=')[1];

            if (
              roleCookie &&
              ['admin', 'manager', 'viewer', 'driver'].includes(roleCookie)
            ) {
              console.warn('AuthProvider: Recovering from error using cookies (session already set from optimistic load)');
              setRole(roleCookie as 'driver' | 'admin' | 'manager' | 'viewer');
              // Session is already set from optimistic load (lines 108-122)
              // Don't overwrite it here
            } else {
              // No fallback available, clear everything
              setSession(null);
              setRole(null);
              writeAuthCookies(null, null);
              localStorage.removeItem('driver_session');
            }
          }
        } catch {
          setSession(null);
          setRole(null);
          writeAuthCookies(null, null);
          localStorage.removeItem('driver_session');
        }

        // Don't show error to user for timeouts, just let them be "logged out" or use cached session
        // setError(err.message || 'Failed to initialize auth');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Listen for Supabase auth state changes (for both admins and drivers)
  useEffect(() => {
    if (!client) return;

    const { data: authListener } = client.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const currentRole = await getCurrentRole(client);
          const currentSession = await getCurrentSession(client);
          setSession(currentSession);
          setRole(currentRole);
          writeAuthCookies(currentRole, currentSession?.userId || null);

          // Update localStorage for driver sessions
          if (currentRole === 'driver' && currentSession) {
            localStorage.setItem('driver_session', JSON.stringify(currentSession));
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setRole(null);
          writeAuthCookies(null, null);
          localStorage.removeItem('driver_session');
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [client]);

  // Handle driver login
  const handleLoginDriver = async (employeeId: string) => {
    try {
      if (!client) {
        throw new Error('Auth client not initialized');
      }
      setError(null);
      const result = await loginAsDriver(client, employeeId);

      if (result.success && result.session) {
        setSession(result.session);
        setRole('driver');
        writeAuthCookies('driver', result.session.userId);
        return { success: true };
      } else {
        const errorMsg = result.error || 'Driver login failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Driver login failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  // Handle admin login
  const handleLoginAdmin = async (username: string, password: string) => {
    try {
      if (!client) {
        throw new Error('Auth client not initialized');
      }
      setError(null);
      const result = await loginAsAdmin(client, username, password);

      if (result.success && result.session) {
        setSession(result.session);
        setRole(result.session.role);
        writeAuthCookies(result.session.role, result.session.userId);
        return { success: true };
      } else {
        const errorMsg = result.error || 'Admin login failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Admin login failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      if (!client) {
        throw new Error('Auth client not initialized');
      }
      setError(null);
      await logout(client);
      setSession(null);
      setRole(null);
      writeAuthCookies(null, null);
      // Clear localStorage
      localStorage.removeItem('driver_session');
    } catch (err: any) {
      setError(err.message || 'Logout failed');
    }
  };

  const value: AuthContextType = {
    session,
    loading,
    error,
    client: client!,
    role,
    loginDriver: handleLoginDriver,
    loginAdmin: handleLoginAdmin,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 * Must be used within AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
