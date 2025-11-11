'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserClient } from '@/lib/auth';

type PostgresChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: any;
  old?: any;
  schema: string;
  table: string;
};

export function NotificationsBadge({
  className,
  refreshOnEvents = true,
}: {
  className?: string;
  refreshOnEvents?: boolean;
}) {
  const [count, setCount] = useState<number>(0);
  const supa = useMemo(() => createBrowserClient(), []);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const isMountedRef = useRef<boolean>(false);

  const fetchUnreadCount = async () => {
    try {
      const { count } = await supa
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false)
        .not('payload->>deleted', 'eq', 'true');
      setCount(count || 0);
      // broadcast to other tabs
      bcRef.current?.postMessage({ type: 'badge:update', count: count || 0 });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    // setup BroadcastChannel for cross-tab sync
    if ('BroadcastChannel' in window) {
      bcRef.current = new BroadcastChannel('notifications-badge');
      bcRef.current.onmessage = (ev: MessageEvent) => {
        const msg = ev.data;
        if (msg && msg.type === 'badge:update' && typeof msg.count === 'number') {
          setCount(msg.count);
        }
      };
    }

    // initial fetch
    fetchUnreadCount();

    // realtime subscription
    const channel = supa
      // @ts-ignore - supabase-js typed, but stable at runtime
      .channel('realtime:notifications-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload: PostgresChangePayload) => {
          // Heuristics: if refreshOnEvents, just refetch; otherwise do a cheap local update
          if (refreshOnEvents) {
            fetchUnreadCount();
            return;
          }
          if (payload.eventType === 'INSERT') {
            const r = payload.new;
            if (r && r.read === false && (!r.payload || r.payload?.deleted !== true)) {
              setCount((c) => c + 1);
            }
          } else if (payload.eventType === 'UPDATE') {
            const before = payload.old;
            const after = payload.new;
            if (before && after) {
              // read flip to true
              if (before.read === false && after.read === true) {
                setCount((c) => Math.max(0, c - 1));
              }
              // soft-deleted a previously unread
              if (
                before.read === false &&
                before?.payload?.deleted !== true &&
                after?.payload?.deleted === true
              ) {
                setCount((c) => Math.max(0, c - 1));
              }
              // undo-delete or mark unread (rare)
              if (
                (before?.payload?.deleted === true && after?.payload?.deleted !== true && after.read === false) ||
                (before.read === true && after.read === false && (!after.payload || after.payload?.deleted !== true))
              ) {
                setCount((c) => c + 1);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const r = payload.old;
            if (r && r.read === false && (!r.payload || r.payload?.deleted !== true)) {
              setCount((c) => Math.max(0, c - 1));
            }
          }
        }
      )
      // @ts-ignore
      .subscribe();

    // storage event fallback for cross-tab (when BroadcastChannel not available)
    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'notifications_badge_count' && typeof e.newValue === 'string') {
        const v = parseInt(e.newValue, 10);
        if (!Number.isNaN(v)) setCount(v);
      }
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      isMountedRef.current = false;
      try {
        // @ts-ignore
        supa.removeChannel?.(channel);
      } catch {
        // ignore
      }
      if (bcRef.current) {
        try {
          bcRef.current.close();
        } catch {
          // ignore
        }
        bcRef.current = null;
      }
      window.removeEventListener('storage', storageHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // keep storage fallback in sync
    try {
      localStorage.setItem('notifications_badge_count', String(count));
    } catch {
      // ignore
    }
  }, [count]);

  // ARIA-friendly badge
  return (
    <span
      aria-label="unread-notifications-count"
      data-testid="unread-notifications-count"
      className={className || 'inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-medium text-white'}
    >
      {count}
    </span>
  );
}


