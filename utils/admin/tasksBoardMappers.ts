import type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
  TaskAssignee,
} from '@/types/task';
import type { Driver } from '@/types/user';
import type { Client, Vehicle } from '@/types/entity';
import type { GroupBy } from '@/types/board';

export function buildDriverMap(drivers: Driver[]): Map<string, Driver> {
  const map = new Map<string, Driver>();
  drivers.forEach((d) => map.set(d.id, d));
  return map;
}

export function buildTaskAssigneeMap(
  assignees: TaskAssignee[]
): Map<string, TaskAssignee[]> {
  const map = new Map<string, TaskAssignee[]>();
  assignees.forEach((ta) => {
    if (!map.has(ta.task_id)) {
      map.set(ta.task_id, []);
    }
    map.get(ta.task_id)!.push(ta);
  });
  return map;
}

export function buildClientMap(clients: Client[]): Map<string, Client> {
  const map = new Map<string, Client>();
  clients.forEach((c) => map.set(c.id, c));
  return map;
}

export function buildVehicleMap(vehicles: Vehicle[]): Map<string, Vehicle> {
  const map = new Map<string, Vehicle>();
  vehicles.forEach((v) => map.set(v.id, v));
  return map;
}

export function computeColumns(params: {
  groupBy: GroupBy;
  assignees: TaskAssignee[];
  driverMap: Map<string, Driver>;
  statusLabel?: (status: TaskStatus) => string;
}): Array<{
  id: string;
  label: string;
  type: 'driver' | 'status';
}> {
  const { groupBy, assignees, driverMap, statusLabel } = params;

  if (groupBy === 'driver') {
    const driverIds = new Set<string>();
    assignees.forEach((ta) => driverIds.add(ta.driver_id));
    return Array.from(driverIds).map((driverId) => ({
      id: driverId,
      label: driverMap.get(driverId)?.name || 'Unknown Driver',
      type: 'driver' as const,
    }));
  }

  const statuses: TaskStatus[] = ['בהמתנה', 'בעבודה', 'חסומה', 'הושלמה'];
  return statuses.map((status) => ({
    id: status,
    label: statusLabel ? statusLabel(status) : status,
    type: 'status' as const,
  }));
}

export function filterTasks(params: {
  tasks: Task[];
  search: string;
  filterType: 'all' | TaskType;
  filterPriority: 'all' | TaskPriority;
  overdueOnly: boolean;
  now?: number;
  clientMap: Map<string, Client>;
  vehicleMap: Map<string, Vehicle>;
}): Task[] {
  const {
    tasks,
    search,
    filterType,
    filterPriority,
    overdueOnly,
    now = Date.now(),
    clientMap,
    vehicleMap,
  } = params;

  const normalized = search.trim().toLowerCase();

  return tasks.filter((t) => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) {
      return false;
    }
    if (overdueOnly) {
      const end = new Date(t.estimated_end).getTime();
      if (!(end < now && t.status !== 'הושלמה')) return false;
    }
    if (normalized) {
      const clientName = t.client_id
        ? clientMap.get(t.client_id)?.name || ''
        : '';
      const vehiclePlate = t.vehicle_id
        ? vehicleMap.get(t.vehicle_id)?.license_plate || ''
        : '';
      const hay = `${t.title} ${clientName} ${vehiclePlate}`.toLowerCase();
      if (!hay.includes(normalized)) return false;
    }
    return true;
  });
}

export function sortTasks(params: {
  tasks: Task[];
  sortBy: 'זמן' | 'עדיפות' | 'נהג';
  sortDir: 'asc' | 'desc';
  driverMap: Map<string, Driver>;
  taskAssigneeMap: Map<string, TaskAssignee[]>;
}): Task[] {
  const { tasks, sortBy, sortDir, driverMap, taskAssigneeMap } = params;

  const priorityRank: Record<TaskPriority, number> = {
    נמוכה: 1,
    בינונית: 2,
    גבוהה: 3,
  };

  const list = tasks.slice().sort((a, b) => {
    if (sortBy === 'עדיפות') {
      const diff = priorityRank[b.priority] - priorityRank[a.priority];
      return diff === 0 ? a.title.localeCompare(b.title) : diff;
    }
    if (sortBy === 'נהג') {
      const la =
        taskAssigneeMap.get(a.id)?.find((x) => x.is_lead)?.driver_id || '';
      const lb =
        taskAssigneeMap.get(b.id)?.find((x) => x.is_lead)?.driver_id || '';
      const na = la ? driverMap.get(la)?.name || '' : '';
      const nb = lb ? driverMap.get(lb)?.name || '' : '';
      return na.localeCompare(nb);
    }
    const ta = new Date(a.estimated_start).getTime();
    const tb = new Date(b.estimated_start).getTime();
    return (
      (sortDir === 'asc' ? ta - tb : tb - ta) ||
      a.title.localeCompare(b.title)
    );
  });

  return list;
}

export function getColumnTasks(params: {
  columnId: string;
  groupBy: GroupBy;
  assignees: TaskAssignee[];
  filteredSortedTasks: Task[];
}): Task[] {
  const { columnId, groupBy, assignees, filteredSortedTasks } = params;

  if (groupBy === 'driver') {
    const assignedTaskIds = assignees
      .filter((ta) => ta.driver_id === columnId)
      .map((ta) => ta.task_id);
    return filteredSortedTasks.filter((t) => assignedTaskIds.includes(t.id));
  }

  return filteredSortedTasks.filter((t) => t.status === columnId);
}


