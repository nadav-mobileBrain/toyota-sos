import { NavBar } from '@/components/ui/tubelight-navbar';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DriverCredentialsManager } from '@/components/admin/DriverCredentialsManager';

export default async function AdminDriversPage() {
  const admin = getSupabaseAdmin();

  let initialDrivers:
    | Array<{
        id: string;
        name: string | null;
        email: string | null;
        employee_id: string | null;
        role: 'driver' | 'admin' | 'manager' | 'viewer';
        created_at: string;
        updated_at: string;
      }>
    | [] = [];

  try {
    const { data, error } = await admin
      .from('profiles')
      .select('id, name, email, employee_id, role, created_at, updated_at')
      .eq('role', 'driver')
      .order('created_at', { ascending: false });

    if (!error && data) {
      initialDrivers = data as any;
    }
  } catch {
    // best-effort; UI will refetch via API if needed
    initialDrivers = [];
  }

  const navItems = [
    { name: 'לוח מחוונים', url: '/admin/dashboard', icon: 'LayoutDashboard' },
    { name: 'משימות', url: '/admin/tasks', icon: 'ClipboardList' },
    { name: 'נהגים', url: '/admin/drivers', icon: 'Users' },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-gray-50 p-8 mx-auto">
      <NavBar items={navItems} className="z-40" />
      <div className="max-w-full mt-4 sm:mt-8 space-y-4">
        <h1 className="text-3xl font-bold text-toyota-primary underline">
          ניהול נהגים
        </h1>
        <DriverCredentialsManager initialDrivers={initialDrivers} />
      </div>
    </main>
  );
}


