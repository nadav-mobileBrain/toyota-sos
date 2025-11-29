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
    try {
      setSigningOut(true);
      // Explicitly clear cookies and storage to ensure full sign out
      document.cookie =
        'toyota_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      await logout();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setSigningOut(false);
      router.replace('/auth/login');
    }
  };

  return (
    <Button
      variant="outline"
      className="text-sm fixed top-4 left-4 z-50 border-primary bg-primary/10 text-primary"
      onClick={handleSignOut}
      disabled={signingOut}
    >
      <LogOutIcon className="w-4 h-4 mr-2" />
      יציאה
    </Button>
  );
}
