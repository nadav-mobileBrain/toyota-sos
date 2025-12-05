'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { LogOutIcon } from 'lucide-react';

export function AdminSignOutButton() {
  const router = useRouter();
  const { logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);

    try {
      // Explicitly clear cookies and storage to ensure full sign out
      document.cookie =
        'toyota_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }

      // Start logout process with timeout to prevent hanging
      const logoutPromise = logout();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Logout timeout')), 3000)
      );

      // Try to logout, but don't wait more than 3 seconds
      await Promise.race([logoutPromise, timeoutPromise]).catch((err) => {
        console.warn('Logout operation timed out or failed:', err);
        // Continue anyway - local state is already cleared
      });
    } catch (err) {
      console.error('Logout error:', err);
      // Continue anyway - we've cleared local state
    } finally {
      // Always redirect, regardless of what happened with Supabase signout
      setSigningOut(false);
      router.replace('/auth/login');
      // Force reload to clear any remaining state
      setTimeout(() => (window.location.href = '/auth/login'), 100);
    }
  };

  return (
    <Button
      variant="outline"
      className="text-sm absolute top-4 left-4 z-50 border-primary bg-blue-600 text-white"
      onClick={handleSignOut}
      disabled={signingOut}
    >
      <LogOutIcon className="w-4 h-4 mr-2" />
      יציאה
    </Button>
  );
}
