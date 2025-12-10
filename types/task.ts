/**
 * Task-related type definitions
 */

export type TaskStatus = 'בהמתנה' | 'בעבודה' | 'חסומה' | 'הושלמה';
export type TaskPriority = 'נמוכה' | 'בינונית' | 'גבוהה';
export type TaskType =
  | 'איסוף רכב/שינוע'
  | 'החזרת רכב/שינוע'
  | 'הסעת רכב חלופי'
  | 'הסעת לקוח הביתה'
  | 'הסעת לקוח למוסך'
  | 'ביצוע טסט'
  | 'חילוץ רכב תקוע'
  | 'אחר';

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_start: string;
  estimated_end: string;
  address: string;
  details: string | null;
  client_id: string | null;
  vehicle_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  advisor_name?: string | null;
  created_at: string;
  updated_at: string;
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
  sort_order: number;
  created_at: string;
  updated_at: string;
}
