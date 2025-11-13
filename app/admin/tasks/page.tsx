import { TasksBoard } from '@/components/admin/TasksBoard';
import type {
  Task,
  Driver,
  TaskAssignee,
  Client,
  Vehicle,
} from '@/components/admin/TasksBoard';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { NavBar } from '@/components/ui/tubelight-navbar';

/**
 * Admin Tasks Page (7.1)
 * Server component that loads initial task and driver data,
 * then renders the TasksBoard component for Kanban view.
 */

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
        updated_at
      `
      )
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      tasksError = error.message;
    } else {
      tasks = data || [];
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
    console.log('🚀 ~ AdminTasksPage ~ data:', data);

    if (!error) {
      clients = data || [];
    }
  } catch (e) {
    console.log('🚀 ~ AdminTasksPage ~ e:', e);
    // silently ignore client fetch errors
  }

  // Fetch vehicles
  let vehicles: Vehicle[] = [];
  try {
    const { data, error } = await admin
      .from('vehicles')
      .select('id, license_plate, model, vin');

    if (!error) {
      vehicles = data || [];
    }
  } catch (e) {
    console.log('🚀 ~ AdminTasksPage ~ e:', e);
    // silently ignore vehicle fetch errors
  }

  const navItems = [
    { name: 'לוח מחוונים', url: '/admin/dashboard', icon: 'LayoutDashboard' },
    { name: 'משימות', url: '/admin/tasks', icon: 'ClipboardList' },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-gray-50 p-8 mx-auto">
      <NavBar items={navItems} className="z-40" />
      <div className="max-w-full mt-4 sm:mt-8">
        <h1 className="mb-6 text-3xl font-bold text-toyota-primary underline">
          לוח משימות
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

        <TasksBoard
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
