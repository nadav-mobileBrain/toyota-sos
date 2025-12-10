'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/AuthProvider';
import { CarFront, LogInIcon, UserIcon } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginDriver, loginAdmin, error: authError } = useAuth();

  const [loginType, setLoginType] = useState<'driver' | 'admin'>('driver');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Driver login form
  const [employeeId, setEmployeeId] = useState('');

  // Admin login form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const redirectTo = (searchParams.get('redirectTo') as string | null) || null;

  const handleDriverLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await loginDriver(employeeId);
      if (result.success) {
        setSuccess('הכניסה בוצעה בהצלחה! מעבר לדף הבית...');
        setTimeout(() => {
          router.push(redirectTo || '/driver');
        }, 500);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('An error occurred');
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await loginAdmin(username, password);
      if (result.success) {
        setSuccess('הכניסה בוצעה בהצלחה! מעבר לדף הבית...');
        setTimeout(() => {
          // If redirectTo is within /admin, normalize to /admin/dashboard as the landing page
          const target =
            redirectTo && !redirectTo.startsWith('/admin')
              ? redirectTo
              : '/admin/dashboard';
          router.push(target);
        }, 500);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('An error occurred');
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-white flex items-center justify-center p-4 text-right"
    >
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">Toyota S.O.S</h1>
          <p className="mt-2 text-gray-600">מערכת ניהול משימות נהגים</p>
        </div>

        {/* Login Type Selector */}
        <div className="flex gap-2 border border-gray-300 rounded-lg p-1 bg-gray-50">
          <button
            onClick={() => {
              setLoginType('driver');
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center ${
              loginType === 'driver'
                ? 'toyota-bg-primary  text-black'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <CarFront className="w-4 h-4 ml-2" />
            נהג
          </button>
          <button
            onClick={() => {
              setLoginType('admin');
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center ${
              loginType === 'admin'
                ? 'toyota-bg-primary text-black'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <UserIcon className="w-4 h-4 ml-2" />
            מנהל / משרד
          </button>
        </div>

        {/* Error Message */}
        {(error || authError) && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error || authError}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* Driver Login Form */}
        {loginType === 'driver' && (
          <form onSubmit={handleDriverLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                מספר עובד
              </label>
              <Input
                type="text"
                placeholder="הזן מספר עובד"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={loading}
                className="w-full"
              />
            </div>
            <Button
              type="submit"
              disabled={!employeeId || loading}
              className="w-full bg-blue-600 hover:bg-red-700 text-white"
            >
              {loading ? 'הכניסה...' : 'כניסה'}
              <LogInIcon className="w-4 h-4 ml-2" />
            </Button>
          </form>
        )}

        {/* Admin Login Form */}
        {loginType === 'admin' && (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שם משתמש
              </label>
              <Input
                type="text"
                placeholder="הזן שם משתמש"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                סיסמה
              </label>
              <Input
                type="password"
                placeholder="הזן סיסמה"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full"
              />
            </div>
            <Button
              type="submit"
              disabled={!username || !password || loading}
              className="w-full bg-blue-600 hover:bg-red-700 text-white"
            >
              {loading ? 'הכניסה...' : 'כניסה'}
              <LogInIcon className="w-4 h-4 ml-2" />
            </Button>
          </form>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-600">
          <p>Version 1.0.1</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
