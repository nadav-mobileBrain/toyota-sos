'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserClient } from '@/lib/auth';
import { trackNotificationReceived } from '@/lib/events';

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
      // Get current user ID from cookies
      const getUserIdFromCookies = () => {
        if (typeof document === 'undefined') return null;
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'toyota_user_id') return value;
        }
        return null;
      };
      
      const userId = getUserIdFromCookies();
      
      // Check Supabase session as fallback
      const { data: { user } } = await supa.auth.getUser();
      const effectiveUserId = userId || user?.id;
      
      let query = supa
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false)
        .or('payload->>deleted.is.null,payload->>deleted.neq.true');
      
      if (effectiveUserId) {
        query = query.eq('user_id', effectiveUserId);
      }
      
      const { count, error } = await query;
      
      if (error) {
        throw error;
      }
      
      const finalCount = count || 0;
      setCount(finalCount);
      // broadcast to other tabs
      bcRef.current?.postMessage({ type: 'badge:update', count: finalCount });
    } catch (err: any) {
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
          // Get current user ID to filter events
          const getUserIdFromCookies = () => {
            if (typeof document === 'undefined') return null;
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
              const [name, value] = cookie.trim().split('=');
              if (name === 'toyota_user_id') return value;
            }
            return null;
          };
          const currentUserId = getUserIdFromCookies();
          
          // Heuristics: if refreshOnEvents, just refetch; otherwise do a cheap local update
          if (refreshOnEvents) {
            // Only refetch if the event is relevant to the current user
            const isRelevantEvent = 
              payload.eventType === 'INSERT' && payload.new?.user_id === currentUserId ||
              payload.eventType === 'UPDATE' && (payload.new?.user_id === currentUserId || payload.old?.user_id === currentUserId) ||
              payload.eventType === 'DELETE' && payload.old?.user_id === currentUserId;
            
            if (isRelevantEvent || !currentUserId) {
              // Add small delay to ensure DB commit completes before querying
              setTimeout(() => {
                fetchUnreadCount();
              }, 500);
            }
            return;
          }
          if (payload.eventType === 'INSERT') {
            const r = payload.new;
            if (r && r.read === false && (!r.payload || r.payload?.deleted !== true)) {
              setCount((c) => c + 1);
            }
            try {
              if (r) trackNotificationReceived({ id: r.id, type: r.type, task_id: r.task_id });
            } catch {
              // optional analytics
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


