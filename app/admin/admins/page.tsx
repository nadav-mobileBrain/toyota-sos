import { NavBar } from '@/components/ui/tubelight-navbar';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { AdminCredentialsManager } from '@/components/admin/AdminCredentialsManager';
import { AdminRow } from '@/utils/admin/admins/types';

export default async function AdminAdminsPage() {
  const admin = getSupabaseAdmin();

  let initialAdmins: AdminRow[] | [] = [];

  try {
    const { data, error } = await admin
      .from('profiles')
      .select('id, name, email, employee_id, role, created_at, updated_at')
      .in('role', ['admin', 'manager', 'viewer'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      initialAdmins = data as AdminRow[];
    }
  } catch {
    // best-effort; UI will refetch via API if needed
    initialAdmins = [];
  }

  const navItems = [
    { name: 'דשבורד', url: '/admin/dashboard', icon: 'LayoutDashboard' },
    { name: 'משימות', url: '/admin/tasks', icon: 'ClipboardList' },
    { name: 'יומן', url: '/admin/calendar', icon: 'Calendar' },
    { name: 'נהגים', url: '/admin/drivers', icon: 'Users' },
    { name: 'מנהלים', url: '/admin/admins', icon: 'ShieldCheck' },
    { name: 'רכבים', url: '/admin/vehicles', icon: 'Car' },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-gray-50 p-8 mx-auto">
      <NavBar items={navItems} className="z-40" />
      <div className="max-w-full mt-4 sm:mt-8 space-y-4">
        <h1 className="text-3xl font-bold text-primary underline">
          ניהול מנהלים
        </h1>
        <AdminCredentialsManager initialAdmins={initialAdmins} />
      </div>
    </main>
  );
}

