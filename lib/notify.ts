'use server';

// Thin wrapper to send Web Push notifications.
// In a real deployment, use the `web-push` library with your VAPID keys.
// Here we provide a stub to be mocked in tests.

export type PushSubscriptionLike = {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function sendWebPush(
  _subscription: PushSubscriptionLike,
  _payload: Record<string, unknown>
): Promise<void> {
  // NO-OP stub. Replace with web-push in production.
  return;
}


