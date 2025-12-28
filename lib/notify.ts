'use server';

import webpush from 'web-push';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import dayjs, { ISRAEL_TZ } from '@/lib/dayjs';

// Thin wrapper to send Web Push notifications.
// In a real deployment, use the `web-push` library with your VAPID keys.

export type PushSubscriptionLike = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
  try {
    webpush.setVapidDetails(
      'mailto:admin@toyota-sos.com',
      publicVapidKey,
      privateVapidKey
    );
  } catch (err) {
    console.error('Failed to set VAPID details:', err);
  }
} else {
  console.warn('VAPID keys are missing. Web Push will not work.');
}

export async function sendWebPush(
  subscription: PushSubscriptionLike,
  payload: Record<string, unknown>
): Promise<void> {
  if (!publicVapidKey || !privateVapidKey) {
    console.warn('VAPID keys not configured, skipping push');
    return;
  }

  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    console.warn('Invalid subscription object, skipping push', subscription);
    return;
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      JSON.stringify(payload)
    );
  } catch (err: any) {
    if (err.statusCode === 410) {
      // Subscription is gone (expired/unsubscribed)
      // We could remove it from DB here if we had DB access, 
      // but usually we just ignore or let a cleanup job handle it.
      console.warn('Subscription expired/gone:', subscription.endpoint);
    } else {
      console.error('Error sending web push:', err);
    }
    // Don't throw, just log, so we don't break the main flow
  }
}

export type NotifyBody = {
  type: string;
  task_id?: string;
  task_date?: string | Date | null;
  payload?: Record<string, unknown>;
  recipients: Array<{
    user_id: string;
    subscription?: PushSubscriptionLike;
  }>;
};

export type NotifyResult =
  | { ok: true; sent: number; inserted: number; pushSkipped?: boolean }
  | { ok: false; error: string; detail?: string };

export async function notify(body: NotifyBody): Promise<NotifyResult> {
  if (!body || !Array.isArray(body.recipients) || !body.type) {
    return { ok: false, error: 'invalid-request' };
  }

  const admin = getSupabaseAdmin();
  
  // No preferences check - send to all recipients

  // Check if we should send push notifications based on task date
  let shouldSendPush = true;
  let taskDate = body.task_date;

  if (body.task_id) {
    // If task_date not provided but task_id is, fetch it
    if (!taskDate) {
      const { data: task } = await admin
        .from('tasks')
        .select('estimated_start')
        .eq('id', body.task_id)
        .single();
      if (task) {
        taskDate = task.estimated_start;
      }
    }

    if (taskDate) {
      const taskDay = dayjs(taskDate).tz(ISRAEL_TZ).startOf('day');
      const today = dayjs().tz(ISRAEL_TZ).startOf('day');
      
      // Only send push if task is today or in the past (to handle late tasks)
      // The requirement was "ביום הנוכחי", but usually it implies "not for future"
      shouldSendPush = !taskDay.isAfter(today);
    }
  }

  // Fetch subscriptions for all recipients
  const userIds = body.recipients.map((r) => r.user_id);
  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds);

  const subMap = new Map<string, PushSubscriptionLike[]>();
  if (subscriptions) {
    subscriptions.forEach((sub: any) => {
      const existing = subMap.get(sub.user_id) || [];
      existing.push({
        endpoint: sub.endpoint,
        keys: sub.keys,
      });
      subMap.set(sub.user_id, existing);
    });
  }

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

  // Send push to all recipients (only if shouldSendPush is true)
  let sent = 0;
  if (shouldSendPush) {
    await Promise.all(
      body.recipients.map(async (r) => {
        // Use fetched subscriptions + any manually provided subscription
        const userSubs = subMap.get(r.user_id) || [];
        if (r.subscription) {
          userSubs.push(r.subscription);
        }

        await Promise.all(
          userSubs.map(async (sub) => {
            if (sub?.endpoint) {
              try {
                await sendWebPush(sub, payload);
                sent++;
              } catch {
                // ignore individual push errors
              }
            }
          })
        );
      })
    );
  }

  // Insert in-app notifications for all recipients
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

  return { ok: true, sent, inserted: insertRows.length, pushSkipped: !shouldSendPush };
}
