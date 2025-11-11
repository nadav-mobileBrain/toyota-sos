import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendWebPush, PushSubscriptionLike } from '@/lib/notify';

export type NotifyBody = {
  type: string;
  task_id?: string;
  payload?: Record<string, unknown>;
  recipients: Array<{
    user_id: string;
    subscription?: PushSubscriptionLike;
  }>;
};

export type NotifyResult =
  | { ok: true; sent: number; inserted: number }
  | { ok: false; error: string; detail?: string };

export async function notify(body: NotifyBody): Promise<NotifyResult> {
  if (!body || !Array.isArray(body.recipients) || !body.type) {
    return { ok: false, error: 'invalid-request' };
  }

  const admin = getSupabaseAdmin();

  const payload = {
    title: body.payload?.title ?? 'עדכון משימה',
    body: body.payload?.body ?? '',
    tag: body.task_id ? `task-${body.task_id}` : undefined,
    data: {
      url: body.payload?.url ?? (body.task_id ? `/driver/tasks/${body.task_id}` : '/'),
      taskId: body.task_id,
      ...(body.payload || {}),
    },
  };

  let sent = 0;
  await Promise.all(
    body.recipients.map(async (r) => {
      if (r.subscription && r.subscription.endpoint) {
        try {
          await sendWebPush(r.subscription, payload);
          sent++;
        } catch {
          // ignore individual push errors
        }
      }
    })
  );

  const insertRows = body.recipients.map((r) => ({
    user_id: r.user_id,
    type: body.type,
    task_id: body.task_id ?? null,
    payload: body.payload ?? {},
    read: false,
  }));

  const { error: insertErr } = await admin.from('notifications').insert(insertRows);
  if (insertErr) {
    return { ok: false, error: 'insert-failed', detail: String(insertErr.message || insertErr) };
  }

  return { ok: true, sent, inserted: insertRows.length };
}


