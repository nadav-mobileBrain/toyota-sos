'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import type { DriverSession } from '@/lib/auth';

export default function DriverProfilePage() {
  const router = useRouter();
  const { logout, loading, error, session } = useAuth();

  const driverSession =
    session?.role === 'driver' ? (session as DriverSession) : null;

  return (
    <main className="min-h-[60vh] p-4 space-y-4" dir="rtl">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold  text-primary underline">
            הפרופיל שלי
          </h2>
          {driverSession && (
            <div className="mt-2 space-y-1">
              <p className="text-gray-800">
                <span className="font-medium">שם:</span>{' '}
                {driverSession.name || '—'}
              </p>
              <p className="text-gray-800">
                <span className="font-medium">מספר עובד:</span>{' '}
                {driverSession.employeeId}
              </p>
            </div>
          )}
        </div>
        <button
          type="button"
          className="rounded-md bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
          onClick={async () => {
            // Clear local storage immediately
            if (typeof window !== 'undefined') {
              localStorage.clear();
              sessionStorage.clear();
            }
            document.cookie =
              'toyota_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';

            // Start logout with timeout
            const logoutPromise = logout();
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Logout timeout')), 3000)
            );

            // Try to logout but don't wait more than 3 seconds
            Promise.race([logoutPromise, timeoutPromise]).catch((err) => {
              console.warn('Logout operation timed out or failed:', err);
            });

            // Redirect immediately
            router.replace('/auth/login');
            setTimeout(() => (window.location.href = '/auth/login'), 100);
          }}
          disabled={loading}
          aria-label="התנתק"
        >
          התנתקות
        </button>
      </header>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </main>
  );
}
