'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardKPIs } from '@/components/admin/dashboard/DashboardKPIs';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { Home, User, Briefcase, FileText } from 'lucide-react';
import { NavBar } from '@/components/ui/tubelight-navbar';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const navItems = [
    { name: 'Home', url: '#', icon: Home },
    { name: 'About', url: '#', icon: User },
    { name: 'Projects', url: '#', icon: Briefcase },
    { name: 'Resume', url: '#', icon: FileText },
  ];
  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await logout();
    } finally {
      setSigningOut(false);
      router.replace('/auth/login');
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 p-4">
      <NavBar items={navItems} className="mb-4" />
      <div className="">
        <Button
          variant="outline"
          className="text-sm fixed top-4 left-4 z-60 border-toyota-primary bg-toyota-primary text-white"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          יציאה
        </Button>
      </div>
      <div className="mx-auto max-w-7xl space-y-4 mt-20">
        {/* Navbar */}
        {/* <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/tasks/"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 underline decoration-dotted"
            >
              מעבר למשימות
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="text-sm"
              onClick={handleSignOut}
              disabled={loading}
            >
              יציאה
            </Button>
          </div>
        </div> */}
        <h1 className="text-xl font-bold text-gray-900">לוח מחוונים</h1>
        <DashboardKPIs />
      </div>
    </div>
  );
}
