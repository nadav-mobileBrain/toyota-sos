'use client';

import { analytics } from './analytics';

type TaskEventCommon = {
  task_id: string;
  type?: string;
  priority?: string;
  assigned_to?: string | null;
  updated_at?: string;
  created_at?: string;
};

export function buildTaskPayload(
  task: any,
  extra?: Record<string, any>
): TaskEventCommon & Record<string, any> {
  return {
    task_id: task?.id,
    type: task?.type,
    priority: task?.priority,
    assigned_to: extra?.assigned_to ?? null,
    created_at: task?.created_at || undefined,
    updated_at: task?.updated_at || new Date().toISOString(),
    ...(extra || {}),
  };
}

export function trackTaskCreated(task: any, leadDriverId?: string) {
  analytics.track(
    'Task Created',
    buildTaskPayload(task, { assigned_to: leadDriverId || null })
  );
}

export function trackTaskAssigned(task: any, driverId: string) {
  analytics.track(
    'Task Assigned',
    buildTaskPayload(task, { assigned_to: driverId })
  );
}

export function trackTaskStatusChange(task: any, newStatus: string) {
  const extra: Record<string, any> = { status: newStatus };
  if (newStatus === 'completed') {
    const end = task?.updated_at
      ? new Date(task.updated_at).getTime()
      : Date.now();
    const start = task?.estimated_start
      ? new Date(task.estimated_start).getTime()
      : undefined;
    if (start) extra.duration_ms = Math.max(0, end - start);
    const eta = task?.estimated_end
      ? new Date(task.estimated_end).getTime()
      : undefined;
    if (eta) extra.on_time = end <= eta;
  }
  analytics.track('Task Status Changed', buildTaskPayload(task, extra));
}

// Form events
export function trackFormSubmitted(params: {
  form: string;
  mode?: string;
  success: boolean;
  task_id?: string;
  error_message?: string;
}) {
  const payload = {
    form: params.form,
    mode: params.mode,
    success: params.success,
    task_id: params.task_id,
    error_message: params.error_message,
    submitted_at: new Date().toISOString(),
  };
  analytics.track('Form Submitted', payload);
}

// Signature events
export function trackSignatureCaptured(params: {
  task_id?: string;
  width: number;
  height: number;
  bytes: number;
  method?: 'export' | 'upload';
  storage_path?: string;
}) {
  const payload = {
    task_id: params.task_id,
    width: params.width,
    height: params.height,
    bytes: params.bytes,
    method: params.method || 'export',
    storage_path: params.storage_path,
    captured_at: new Date().toISOString(),
  };
  analytics.track('Signature Captured', payload);
}

// Notification events
export function trackNotificationReceived(row: {
  id: string;
  type?: string;
  task_id?: string | null;
}) {
  analytics.track('Notification Received', {
    notification_id: row.id,
    type: row.type,
    task_id: row.task_id || undefined,
    received_at: new Date().toISOString(),
  });
}

export function trackNotificationOpened(row: {
  id: string;
  type?: string;
  task_id?: string | null;
}) {
  analytics.track('Notification Opened', {
    notification_id: row.id,
    type: row.type,
    task_id: row.task_id || undefined,
    opened_at: new Date().toISOString(),
  });
}
// Auth events
export function trackLoginAttempt(role: 'driver' | 'admin') {
  analytics.track('Login Attempt', { role });
}

export function trackLoginSuccess(role: 'driver' | 'admin', userId?: string) {
  if (userId) analytics.identify(userId);
  analytics.track('Login Success', { role });
}

export function trackLoginFailed(role: 'driver' | 'admin', error: string) {
  analytics.track('Login Failed', { role, error });
}

// Driver events
export function trackTaskViewed(taskId: string) {
  analytics.track('Task Viewed', { task_id: taskId });
}

export function trackNavigationStarted(taskId: string, address: string) {
  analytics.track('Navigation Started', {
    task_id: taskId,
    address,
    method: 'waze',
  });
}
