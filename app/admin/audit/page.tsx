import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NavBar } from '@/components/ui/tubelight-navbar';
import { AuditFeed } from '@/components/admin/AuditFeed';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminAuditPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get('toyota_role')?.value;

  // Protect the page: only admin and manager can view audit logs
  if (role !== 'admin' && role !== 'manager' && role !== 'viewer') {
    redirect('/admin/dashboard');
  }

  const navItems = [
    { name: 'דשבורד', url: '/admin/dashboard', icon: 'LayoutDashboard' },
    { name: 'משימות', url: '/admin/tasks', icon: 'ClipboardList' },
    { name: 'יומן', url: '/admin/calendar', icon: 'Calendar' },
    { name: 'נהגים', url: '/admin/drivers', icon: 'Users' },
    { name: 'מנהלים', url: '/admin/admins', icon: 'ShieldCheck' },
    { name: 'רכבים', url: '/admin/vehicles', icon: 'Car' },
    { name: 'לוג שינויים', url: '/admin/audit', icon: 'History' },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-gray-50 p-8 mx-auto">
      <NavBar items={navItems} className="z-40" />
      <div className="max-w-4xl mx-auto mt-4 sm:mt-8 space-y-4 text-right">
        <h1 className="text-3xl font-bold text-primary underline mb-6">
          לוג שינויים מערכת
        </h1>
        <div className="bg-white rounded-lg shadow p-6">
          <AuditFeed taskId={null} />
        </div>
      </div>
    </main>
  );
}
