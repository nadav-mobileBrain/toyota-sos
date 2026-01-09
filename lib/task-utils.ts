import type { TaskStatus, TaskPriority, TaskType } from '@/types/task';

/**
 * Utility functions for task-related labels and colors
 */

export function statusLabel(status: TaskStatus | string): string {
  const labels: Record<string, string> = {
    בהמתנה: 'ממתינה לביצוע',
    בעבודה: 'בביצוע',
    חסומה: 'חסומה',
    הושלמה: 'בוצעה',
    // English fallbacks just in case
    pending: 'ממתינה לביצוע',
    in_progress: 'בביצוע',
    blocked: 'חסומה',
    completed: 'בוצעה',
  };
  return labels[status] || status;
}

export function statusColor(status: TaskStatus | string): string {
  const colors: Record<string, string> = {
    בהמתנה: 'bg-gray-100 text-gray-800',
    בעבודה: 'bg-blue-100 text-blue-800',
    חסומה: 'bg-red-100 text-red-800',
    הושלמה: 'bg-green-100 text-green-800',
    pending: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    blocked: 'bg-red-100 text-red-800',
    completed: 'bg-green-100 text-green-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function priorityLabel(priority: TaskPriority | string): string {
  const labels: Record<string, string> = {
    'ללא עדיפות': 'ללא עדיפות',
    מיידי: 'מיידי',
    נמוכה: 'נמוכה',
    בינונית: 'בינונית',
    גבוהה: 'גבוהה',
    low: 'נמוכה',
    medium: 'בינונית',
    high: 'גבוהה',
  };
  return labels[priority] || priority;
}

export function priorityColor(priority: TaskPriority | string): string {
  const colors: Record<string, string> = {
    'ללא עדיפות': 'bg-gray-400',
    מיידי: 'bg-red-600',
    נמוכה: 'bg-gray-500',
    בינונית: 'bg-yellow-500',
    גבוהה: 'bg-red-600',
    low: 'bg-gray-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-600',
  };
  return colors[priority] || 'bg-gray-500';
}

export function typeLabel(type: TaskType | string): string {
  const labels: Record<string, string> = {
    'איסוף רכב/שינוע פרטי': 'איסוף רכב/שינוע פרטי',
    'איסוף רכב/שינוע+טסט': 'איסוף רכב/שינוע+טסט',
    'איסוף רכב/שינוע+טסט מוביליטי': 'איסוף רכב/שינוע+טסט מוביליטי',
    'החזרת רכב/שינוע פרטי': 'החזרת רכב/שינוע פרטי',
    'מסירת רכב חלופי': 'מסירת רכב חלופי',
    'הסעת לקוח הביתה': 'הסעת לקוח הביתה',
    'הסעת לקוח למוסך': 'הסעת לקוח למוסך',
    'ביצוע טסט': 'ביצוע טסט',
    'חילוץ רכב תקוע': 'חילוץ רכב תקוע',
    אחר: 'אחר',
  };
  return labels[type] || type;
}
