import { NavBar } from '@/components/ui/tubelight-navbar';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { VehicleCredentialsManager } from '@/components/admin/VehicleCredentialsManager';
import type { VehicleRow } from '@/utils/admin/vehicles/types';

export default async function AdminVehiclesPage() {
  const admin = getSupabaseAdmin();

  let initialVehicles: VehicleRow[] | [] = [];

  try {
    const { data, error } = await admin
      .from('vehicles')
      .select('id, license_plate, model, is_available, unavailability_reason, created_at')
      .order('created_at', { ascending: false });

    if (!error && data) {
      initialVehicles = data as VehicleRow[];
    }
  } catch {
    // best-effort; UI will refetch via API if needed
    initialVehicles = [];
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
          ניהול רכבים
        </h1>
        <VehicleCredentialsManager initialVehicles={initialVehicles} />
      </div>
    </main>
  );
}

