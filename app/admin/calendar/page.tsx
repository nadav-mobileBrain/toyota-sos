import { NavBar } from '@/components/ui/tubelight-navbar';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { CalendarShell } from '@/components/admin/calendar/CalendarShell';
import type { Task, TaskAssignee } from '@/types/task';
import type { Driver } from '@/types/user';
import type { Client, Vehicle } from '@/types/entity';
import { CalendarDays } from 'lucide-react';

// Disable caching to ensure fresh data on every page load
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminCalendarPage() {
  const admin = getSupabaseAdmin();

  // Fetch tasks with stops
  let tasks: Task[] = [];
  let tasksError: string | null = null;
  try {
    const { data, error } = await admin
      .from('tasks')
      .select(
        `
        *,
        task_stops(id, task_id, client_id, address, advisor_name, advisor_color, sort_order, distance_from_garage, created_at, updated_at)
      `
      )
      .order('estimated_start', { ascending: true });

    if (error) {
      tasksError = error.message;
    } else {
      tasks = (data || []).map((task: any) => ({
        ...task,
        stops: task.task_stops
          ? task.task_stops
              .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
              .map((stop: any) => ({
                id: stop.id,
                task_id: task.id,
                client_id: stop.client_id,
                address: stop.address,
                advisor_name: stop.advisor_name,
                advisor_color: stop.advisor_color,
                sort_order: stop.sort_order,
                distance_from_garage: stop.distance_from_garage,
                created_at: stop.created_at,
                updated_at: stop.updated_at,
              }))
          : undefined,
      }));
    }
  } catch {
    tasksError = 'שגיאה בטעינת משימות';
  }

  // Fetch drivers
  let drivers: Driver[] = [];
  let driversError: string | null = null;
  try {
    const { data, error } = await admin
      .from('profiles')
      .select('id, name, email, employee_id, role, created_at, updated_at')
      .eq('role', 'driver')
      .order('name', { ascending: true });

    if (error) {
      driversError = error.message;
    } else {
      drivers = data as Driver[];
    }
  } catch {
    driversError = 'שגיאה בטעינת נהגים';
  }

  // Fetch task assignees
  let taskAssignees: TaskAssignee[] = [];
  let assigneesError: string | null = null;
  try {
    const { data, error } = await admin.from('task_assignees').select('*');

    if (error) {
      assigneesError = error.message;
    } else {
      taskAssignees = data || [];
    }
  } catch {
    assigneesError = 'שגיאה בטעינת הקצאות';
  }

  // Fetch clients
  let clients: Client[] = [];
  try {
    const { data, error } = await admin
      .from('clients')
      .select('id, name, phone, email');

    if (!error) {
      clients = data || [];
    }
  } catch {
    // silently ignore client fetch errors
  }

  // Fetch vehicles
  let vehicles: Vehicle[] = [];
  try {
    const { data, error } = await admin
      .from('vehicles')
      .select('id, license_plate, model');

    if (!error) {
      vehicles = data || [];
    }
  } catch {
    // silently ignore vehicle fetch errors
  }

  const navItems = [
    { name: 'דשבורד', url: '/admin/dashboard', icon: 'LayoutDashboard' },
    { name: 'משימות', url: '/admin/tasks', icon: 'ClipboardList' },
    { name: 'יומן', url: '/admin/calendar', icon: 'Calendar' },
    { name: 'נהגים', url: '/admin/drivers', icon: 'Users' },
    { name: 'מנהלים', url: '/admin/admins', icon: 'ShieldCheck' },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-gray-50">
      <NavBar items={navItems} className="z-40" />
      <div className="mx-auto max-w-full p-4 pt-20 sm:p-6 sm:pt-24 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="relative">
            <CalendarDays className="h-8 w-8 text-toyota-red" />
            <div className="absolute inset-0 h-8 w-8 rounded-lg bg-toyota-red/20 blur-md" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">יומן משימות</h1>
        </div>

        {/* Error Messages */}
        {(tasksError || driversError || assigneesError) && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-700">
              שגיאה בטעינת נתונים
            </p>
            {tasksError && (
              <p className="text-xs text-red-600">משימות: {tasksError}</p>
            )}
            {driversError && (
              <p className="text-xs text-red-600">נהגים: {driversError}</p>
            )}
            {assigneesError && (
              <p className="text-xs text-red-600">הקצאות: {assigneesError}</p>
            )}
          </div>
        )}

        {/* Calendar Component */}
        <CalendarShell
          initialTasks={tasks}
          drivers={drivers}
          taskAssignees={taskAssignees}
          clients={clients}
          vehicles={vehicles}
        />
      </div>
    </main>
  );
}

