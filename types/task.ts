/**
 * Task-related type definitions
 */

export type TaskStatus = 'בהמתנה' | 'בעבודה' | 'חסומה' | 'הושלמה';
export type TaskPriority =
  | 'ללא עדיפות'
  | 'מיידי'
  | 'נמוכה'
  | 'בינונית'
  | 'גבוהה';
export type TaskType =
  | 'איסוף רכב/שינוע פרטי'
  | 'איסוף רכב/שינוע+טסט'
  | 'איסוף רכב/שינוע+טסט מוביליטי'
  | 'החזרת רכב/שינוע פרטי'
  | 'החזרת רכב מוביליטי'
  | 'מסירת רכב חלופי'
  | 'הסעת לקוח הביתה'
  | 'הסעת לקוח למוסך'
  | 'ביצוע טסט'
  | 'חילוץ רכב תקוע'
  | 'אחר';
export type AdvisorColor = 'צהוב' | 'ירוק' | 'כתום' | 'סגול בהיר';

export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_start: string;
  estimated_end: string;
  address: string;
  details: string | null;
  client_id: string | null;
  vehicle_id: string | null;
  client_vehicle_id?: string | null;
  created_by: string | null;
  updated_by: string | null;
  advisor_name?: string | null;
  advisor_color?: AdvisorColor | null;
  phone?: string | null;
  created_at: string;
  updated_at: string;
  admin_notified_late_start?: boolean;
  distance_from_garage?: number | null;
  lat?: number | null;
  lng?: number | null;
  deleted_at?: string | null;
  source_task_id?: string | null;
  stops?: TaskStop[];
}

export interface TaskAssignee {
  id: string;
  task_id: string;
  driver_id: string;
  is_lead: boolean;
  assigned_at: string;
}

export interface TaskStop {
  id: string;
  task_id: string;
  client_id: string | null;
  address: string;
  advisor_name: string | null;
  advisor_color: AdvisorColor | null;
  sort_order: number;
  phone?: string | null;
  distance_from_garage?: number | null;
  lat?: number | null;
  lng?: number | null;
  created_at: string;
  updated_at: string;
  is_picked_up?: boolean;
}

// Calendar view types
export type CalendarView = 'week' | 'month';

export interface TaskDragEvent {
  taskId: string;
  newStartDate: string;
  newEndDate: string;
}

export interface CalendarFilters {
  taskTypes: TaskType[];
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  driverIds: string[];
  clientIds: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}
