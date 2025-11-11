'use client';

// Utilities and helpers for Web Push configuration
//  - Read the public VAPID key from env
//  - Validate base64url format
//  - Convert base64url string to Uint8Array for PushManager.subscribe

export function getVapidPublicKey(): string {
  // Next.js exposes public env vars via process.env at build-time
  // Ensure this variable is set in .env.local or deployment env
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
}

export function isBase64Url(input: string): boolean {
  // RFC 4648 URL-safe base64 without padding (padding optional)
  // Accepts characters A-Z a-z 0-9 _ -
  // Optional padding '=' characters at the end
  if (!input || typeof input !== 'string') return false;
  const re = /^[A-Za-z0-9\-_]+={0,2}$/;
  return re.test(input);
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Convert a base64url string to Uint8Array
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = typeof window !== 'undefined'
    ? window.atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Convenience: get the key as Uint8Array, throwing if invalid/missing
export function getVapidApplicationServerKey(): Uint8Array {
  const pub = getVapidPublicKey();
  if (!pub) {
    throw new Error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY');
  }
  if (!isBase64Url(pub)) {
    throw new Error('Invalid base64url in NEXT_PUBLIC_VAPID_PUBLIC_KEY');
  }
  return urlBase64ToUint8Array(pub);
}


