'use client';

type FlagsMap = Map<string, boolean>;

type Listener = (flags: Readonly<Record<string, boolean>>) => void;

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: FlagsMap = new Map();
let cacheExpiresAt = 0;
const listeners = new Set<Listener>();
let inflight: Promise<Record<string, boolean>> | null = null;

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
    listener(Object.fromEntries(cache.entries()));
  } catch {}
  return () => listeners.delete(listener);
}

export function isStale() {
  return Date.now() >= cacheExpiresAt;
}

async function fetchFlags(): Promise<Record<string, boolean>> {
  const res = await fetch('/api/admin/flags', { cache: 'no-store' });
  if (!res.ok) throw new Error(await res.text().catch(() => 'flags fetch failed'));
  const json = await res.json();
  const rows: Array<{ key: string; enabled: boolean }> = json?.data || [];
  const obj: Record<string, boolean> = {};
  for (const row of rows) {
    obj[row.key] = !!row.enabled;
  }
  return obj;
}

export async function getFlags(force = false): Promise<Record<string, boolean>> {
  if (!force && !isStale() && cache.size > 0) {
    return Object.fromEntries(cache.entries());
  }
  if (!inflight) {
    inflight = fetchFlags()
      .then((obj) => {
        cache = new Map(Object.entries(obj));
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        emit();
        return obj;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function isEnabled(key: string): boolean {
  return !!cache.get(key);
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


