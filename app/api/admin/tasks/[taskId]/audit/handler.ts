import { createServiceRoleClient } from '@/lib/auth';

export type ListTaskAuditParams = {
  taskId?: string | null;
  limit?: number;
  offset?: number;
  role?: string | null;
  supaOverride?: any;
};

export async function listTaskAudit(params: ListTaskAuditParams) {
  const { taskId } = params;
  const limit = Math.min(500, Math.max(1, params.limit ?? 100));
  const offset = Math.max(0, params.offset ?? 0);
  const role = params.role ?? null;

  if (!role || (role !== 'admin' && role !== 'manager' && role !== 'viewer')) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  const supa = params.supaOverride ?? createServiceRoleClient();
  let query = supa
    .from('task_audit_log')
    .select(
      `
      id, 
      task_id, 
      actor_id, 
      action, 
      changed_at, 
      before, 
      after, 
      diff,
      actor:profiles!actor_id (name, email)
    `
    )
    .order('changed_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (taskId) {
    query = query.eq('task_id', taskId);
  }

  const { data, error } = await query;

  if (error) {
    return { status: 500, body: { error: error.message } };
  }
  return { status: 200, body: { data: data ?? [] } };
}
