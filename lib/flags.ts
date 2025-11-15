'use client';

type FlagsMap = Map<string, boolean>;

type Listener = (flags: Readonly<Record<string, boolean>>) => void;

const CACHE_TTL_MS = 5 * 60 * 1000;

// Reasonable defaults so features remain visible unless explicitly disabled in DB
const DEFAULT_FLAGS: Record<string, boolean> = {
  bulk_operations_enabled: true,
  multi_driver_assignment: true,
  signature_required: false,
  pdf_generation: false,
};

let cache: FlagsMap = new Map();
let cacheExpiresAt = 0;
const listeners = new Set<Listener>();
let inflight: Promise<Record<string, boolean>> | null = null;

function getRoleFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const parts = document.cookie.split(';').map((c) => c.trim());
    const entry = parts.find((c) => c.startsWith('toyota_role='));
    if (!entry) return null;
    return decodeURIComponent(entry.split('=').slice(1).join('='));
  } catch {
    return null;
  }
}

function emit() {
  const obj = Object.fromEntries(cache.entries());
  for (const l of Array.from(listeners)) {
    try {
      l(obj);
    } catch {
      // ignore
    }
  }
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  // push current snapshot immediately
  try {
    const snapshot = { ...DEFAULT_FLAGS, ...Object.fromEntries(cache.entries()) };
    listener(snapshot);
  } catch {}
  return () => listeners.delete(listener);
}

export function isStale() {
  return Date.now() >= cacheExpiresAt;
}

async function fetchFlags(): Promise<Record<string, boolean>> {
  // Drivers never need admin feature flags; avoid hitting the admin API entirely
  const role = getRoleFromCookie();
  if (role === 'driver') {
    return {};
  }

  try {
    const res = await fetch('/api/admin/flags', { cache: 'no-store' });
    if (!res.ok) {
      // For non-admin roles 401 is expected; just fall back to defaults without noisy errors
      if (res.status !== 401) {
        // eslint-disable-next-line no-console
        console.warn('flags fetch failed', res.status);
      }
      return {};
    }
    const json = await res.json();
    const rows: Array<{ key: string; enabled: boolean }> = json?.data || [];
    const obj: Record<string, boolean> = {};
    for (const row of rows) {
      obj[row.key] = !!row.enabled;
    }
    return obj;
  } catch {
    // Network or other failure → fall back to defaults
    return {};
  }
}

export async function getFlags(force = false): Promise<Record<string, boolean>> {
  if (!force && !isStale() && cache.size > 0) {
    return { ...DEFAULT_FLAGS, ...Object.fromEntries(cache.entries()) };
  }
  if (!inflight) {
    inflight = fetchFlags()
      .then((obj) => {
        const merged = { ...DEFAULT_FLAGS, ...obj };
        cache = new Map(Object.entries(merged));
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        emit();
        return merged;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function isEnabled(key: string): boolean {
  if (cache.has(key)) return !!cache.get(key);
  return !!DEFAULT_FLAGS[key];
}

export async function setFlag(key: string, enabled: boolean): Promise<void> {
  // optimistic update
  cache.set(key, enabled);
  emit();
  try {
    const res = await fetch('/api/admin/flags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, enabled }),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => 'toggle failed'));
    // On success, invalidate expiry to keep fresh for 5m
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  } catch (e) {
    // rollback optimistic change on failure
    cache.set(key, !enabled);
    emit();
    throw e;
  }
}


