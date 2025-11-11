// Enhanced notify handler that respects notification preferences
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
  | { ok: true; sent: number; inserted: number; filtered: number }
  | { ok: false; error: string; detail?: string };

export async function notifyWithPreferences(body: NotifyBody): Promise<NotifyResult> {
  if (!body || !Array.isArray(body.recipients) || !body.type) {
    return { ok: false, error: 'invalid-request' };
  }

  const admin = getSupabaseAdmin();
  const eventType = body.type;

  // Fetch preferences for all recipients
  const userIds = body.recipients.map((r) => r.user_id);
  const { data: prefs, error: prefErr } = await admin
    .from('notification_preferences')
    .select('*')
    .in('user_id', userIds)
    .eq('event_type', eventType);

  if (prefErr) {
    console.warn('Failed to fetch preferences:', prefErr);
  }

  const prefMap = new Map<string, boolean>();
  (prefs as any[] || []).forEach((p) => {
    prefMap.set(p.user_id, p.enabled ?? true);
  });

  // Filter recipients: exclude those who disabled this event type
  const filteredRecipients = body.recipients.filter((r) => prefMap.get(r.user_id) ?? true);
  const filtered = body.recipients.length - filteredRecipients.length;

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

  // Send push to filtered recipients
  let sent = 0;
  await Promise.all(
    filteredRecipients.map(async (r) => {
      if (r.subscription?.endpoint) {
        try {
          await sendWebPush(r.subscription, payload);
          sent++;
        } catch {
          // ignore individual push errors
        }
      }
    })
  );

  // Insert in-app notifications only for recipients who haven't disabled this type
  const insertRows = filteredRecipients.map((r) => ({
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

  return { ok: true, sent, inserted: insertRows.length, filtered };
}

