import type {
  Task,
  Driver,
  TaskAssignee,
  Client,
  Vehicle,
} from '@/components/admin/TasksBoard';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { NavBar } from '@/components/ui/tubelight-navbar';
import { AdminTasksShell } from '@/components/admin/AdminTasksShell';

/**
 * Admin Tasks Page (7.1)
 * Server component that loads initial task and driver data,
 * then renders the TasksBoard component for Kanban view.
 */

// Disable caching to ensure fresh data on every page load
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminTasksPage() {
  const admin = getSupabaseAdmin();

  // Fetch initial tasks
  let tasks: Task[] = [];
  let tasksError: string | null = null;

  try {
    const { data, error } = await admin
      .from('tasks')
      .select(
        `
        id,
        title,
        type,
        priority,
        status,
        estimated_start,
        estimated_end,
        address,
        details,
        client_id,
        vehicle_id,
        created_by,
        updated_by,
        created_at,
        updated_at,
        advisor_name,
        advisor_color,
        distance_from_garage,
        task_stops(id, client_id, address, advisor_name, advisor_color, phone, sort_order, distance_from_garage)
      `
      )
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(100);

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
                phone: stop.phone || null,
                sort_order: stop.sort_order,
                distance_from_garage: stop.distance_from_garage,
                created_at: '',
                updated_at: '',
              }))
          : undefined,
      }));
    }
  } catch (e) {
    tasksError = e instanceof Error ? e.message : 'Failed to fetch tasks';
  }

  // Fetch drivers (profiles with role='driver')
  let drivers: Driver[] = [];
  let driversError: string | null = null;

  try {
    const { data, error } = await admin
      .from('profiles')
      .select('id, name, email, role')
      .eq('role', 'driver')
      .order('name', { ascending: true });

    if (error) {
      driversError = error.message;
    } else {
      drivers = data || [];
    }
  } catch (e) {
    driversError = e instanceof Error ? e.message : 'Failed to fetch drivers';
  }

  // Fetch active driver breaks
  let driverBreaks: Record<string, boolean> = {};
  let breaksError: string | null = null;

  try {
    const { data: breaksData, error: breaksErrorData } = await admin
      .from('driver_breaks')
      .select('driver_id')
      .is('ended_at', null);

    if (breaksErrorData) {
      breaksError = breaksErrorData.message;
    } else {
      // Create an object of driver_id -> true for drivers on break
      breaksData?.forEach((breakRecord) => {
        driverBreaks[breakRecord.driver_id] = true;
      });
    }
  } catch (e) {
    breaksError = e instanceof Error ? e.message : 'Failed to fetch breaks';
  }

  // Fetch driver assignments for tasks
  let taskAssignees: TaskAssignee[] = [];
  let assigneesError: string | null = null;

  try {
    const { data, error } = await admin
      .from('task_assignees')
      .select('id, task_id, driver_id, is_lead, assigned_at');

    if (error) {
      assigneesError = error.message;
    } else {
      taskAssignees = data || [];
    }
  } catch (e) {
    assigneesError =
      e instanceof Error ? e.message : 'Failed to fetch assignees';
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
  } catch (e) {
    console.log('🚀 ~ AdminTasksPage ~ e:', e);
    // silently ignore client fetch errors
  }

  // Fetch vehicles (include all vehicles, TaskDialog will filter unavailable ones)
  let vehicles: Vehicle[] = [];
  try {
    const { data, error } = await admin
      .from('vehicles')
      .select('id, license_plate, model, is_available, unavailability_reason');

    if (!error) {
      vehicles = data || [];
    }
  } catch (e) {
    console.log('🚀 ~ AdminTasksPage ~ e:', e);
    // silently ignore vehicle fetch errors
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
          לוח משימות נהגים{' '}
        </h1>

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

        <AdminTasksShell
          initialTasks={tasks}
          drivers={drivers}
          taskAssignees={taskAssignees}
          clients={clients}
          vehicles={vehicles}
          driverBreaks={driverBreaks}
        />
      </div>
    </main>
  );
}
