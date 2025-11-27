'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { NavBar } from '@/components/ui/tubelight-navbar';
import { DashboardKPIs } from '@/components/admin/dashboard/DashboardKPIs';
import { PeriodProvider } from '@/components/admin/dashboard/PeriodContext';
import { PeriodFilter } from '@/components/admin/dashboard/PeriodFilter';
import { DashboardCharts } from '@/components/admin/DashboardCharts';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const navItems = [
    { name: 'דשבורד', url: '/admin/dashboard', icon: 'LayoutDashboard' },
    { name: 'משימות', url: '/admin/tasks', icon: 'ClipboardList' },
    { name: 'נהגים', url: '/admin/drivers', icon: 'Users' },
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
      <NavBar items={navItems} className="z-40" />
      <div className="">
        <Button
          variant="outline"
          className="text-sm fixed top-4 left-4 z-50 border-primary bg-primary/10 text-primary"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          יציאה
        </Button>
      </div>
      <PeriodProvider>
        <div className="mx-auto mt-20 max-w-7xl space-y-4 sm:mt-24">
          <h1 className="text-4xl font-bold text-primary underline">
            דשבורד נהגים
          </h1>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <PeriodFilter />
          </div>
          <DashboardKPIs />
          <DashboardCharts />
        </div>
      </PeriodProvider>
    </div>
  );
}
