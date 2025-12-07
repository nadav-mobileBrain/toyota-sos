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
      try {
        setLoading(true);

        // Create client first
        const supabaseClient = createBrowserClient();
        setClient(supabaseClient);

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<AuthSession>((_, reject) =>
          setTimeout(() => reject(new Error('Auth initialization timeout')), 5000)
        );

        const authPromise = getCurrentSession(supabaseClient);

        const currentSession = await Promise.race([
          authPromise,
          timeoutPromise,
        ]);

        const currentRole = currentSession?.role || null;

        setSession(currentSession);
        setRole(currentRole);
        writeAuthCookies(currentRole, currentSession?.userId || null);
        setError(null);
      } catch (err: any) {
        // On timeout or error, clear session and allow user to login again
        console.warn('Auth initialization failed:', err.message || 'Unknown error');
        setError(null); // Don't show error to user, just clear session
        setSession(null);
        setRole(null);
        writeAuthCookies(null, null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Listen for Supabase auth state changes (for admins)
  useEffect(() => {
    if (!client) return;

    const { data: authListener } = client.auth.onAuthStateChange(
      async (event, supabaseSession) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const currentRole = await getCurrentRole(client);
          const currentSession = await getCurrentSession(client);
          setSession(currentSession);
          setRole(currentRole);
          writeAuthCookies(currentRole, currentSession?.userId || null);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setRole(null);
          writeAuthCookies(null, null);
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
