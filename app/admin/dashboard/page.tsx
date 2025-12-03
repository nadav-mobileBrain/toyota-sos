'use client';

import { NavBar } from '@/components/ui/tubelight-navbar';
import { DashboardKPIs } from '@/components/admin/dashboard/DashboardKPIs';
import { PeriodProvider } from '@/components/admin/dashboard/PeriodContext';
import { PeriodFilter } from '@/components/admin/dashboard/PeriodFilter';
import { DashboardCharts } from '@/components/admin/DashboardCharts';

export default function AdminDashboardPage() {
  const navItems = [
    { name: 'דשבורד', url: '/admin/dashboard', icon: 'LayoutDashboard' },
    { name: 'משימות', url: '/admin/tasks', icon: 'ClipboardList' },
    { name: 'נהגים', url: '/admin/drivers', icon: 'Users' },
    { name: 'מנהלים', url: '/admin/admins', icon: 'ShieldCheck' },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 p-4">
      <NavBar items={navItems} className="z-40" />
      <PeriodProvider>
        <div className="mx-auto mt-20 max-w-7xl space-y-4 sm:mt-24">
          <h1 className="text-4xl font-bold text-black text-center">
            דשבורד ניהול משימות{' '}
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
