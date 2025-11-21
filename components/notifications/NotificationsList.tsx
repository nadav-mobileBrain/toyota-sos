'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { trackNotificationOpened } from '@/lib/events';

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  task_id: string | null;
  payload: any;
  read: boolean;
  created_at: string;
};

export function NotificationsList({ pageSize = 20 }: { pageSize?: number }) {
  const router = useRouter();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const supa = useMemo(() => createBrowserClient(), []);

  const fetchPage = async (pageIndex: number) => {
    setLoading(true);
    setError(null);
    try {
      const from = pageIndex * pageSize;
      const to = from + pageSize - 1;
      // Fetch notifications (client-side filter for soft-delete for now to avoid null issues)
      const { data, error } = await supa
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      
      const validRows = (data as NotificationRow[] || []).filter(r => {
        const deleted = r.payload?.deleted;
        return deleted !== true && deleted !== 'true';
      });
      setRows(validRows);
    } catch (e: any) {
      setError(e?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const unread = rows.filter((r) => !r.read);
  const read = rows.filter((r) => r.read);

  const toggleSelect = (id: string, value?: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: value ?? !prev[id] }));
  };

  const markAsRead = async (id: string) => {
    const { error } = await supa.from('notifications').update({ read: true }).eq('id', id);
    if (!error) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, read: true } : r)));
    }
  };

  const markSelectedAsRead = async () => {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (ids.length === 0) return;
    const res = await supa.from('notifications').update({ read: true }).in('id', ids);
    const err = (res as any)?.error ?? null;
    if (!err) {
      setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, read: true } : r)));
      setSelected({});
    }
  };

  const deleteNotification = async (id: string) => {
    // Soft delete via payload.deleted = true (client-side jsonb merge then update)
    const target = rows.find((r) => r.id === id);
    if (!target) return;
    const nextPayload = { ...(target.payload || {}), deleted: true };
    const { error } = await supa.from('notifications').update({ payload: nextPayload }).eq('id', id);
    if (!error) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const deleteSelected = async () => {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (ids.length === 0) return;
    // batch soft-delete (client-side payload update per row)
    const updates = rows
      .filter((r) => ids.includes(r.id))
      .map((r) => ({ id: r.id, payload: { ...(r.payload || {}), deleted: true } }));
    const { error } = await supa.from('notifications').upsert(updates, { onConflict: 'id' });
    if (!error) {
      setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      setSelected({});
    }
  };

  const onOpen = (row: NotificationRow) => {
    try {
      trackNotificationOpened({ id: row.id, type: row.type, task_id: row.task_id });
    } catch {
      // optional analytics
    }
    if (row.task_id) {
      router.push(`/driver/tasks/${row.task_id}`);
    }
  };

  return (
    <div dir="rtl" className="w-full max-w-2xl">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          aria-label="סמן כנקראו"
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={markSelectedAsRead}
          disabled={Object.values(selected).every((v) => !v)}
        >
          סמן כנקראו
        </button>
        <button
          type="button"
          aria-label="מחק"
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={deleteSelected}
          disabled={Object.values(selected).every((v) => !v)}
        >
          מחק
        </button>
      </div>

      {loading ? <div role="status">טוען...</div> : null}
      {error ? <div role="alert" className="text-red-600 text-sm">{error}</div> : null}

      {unread.length > 0 ? <h3 className="mt-2 mb-1 font-semibold">חדשים</h3> : null}
      <ul>
        {unread.map((r) => (
          <li key={r.id} className="flex items-center gap-2 rounded border p-2 mb-2 bg-white">
            <input
              type="checkbox"
              aria-label={`בחר התראה ${r.type}`}
              checked={!!selected[r.id]}
              onChange={(e) => toggleSelect(r.id, e.target.checked)}
            />
            <button
              type="button"
              className="flex-1 text-right"
              onClick={() => onOpen(r)}
              aria-label="פתח"
            >
              <div className="text-sm">{r.type}</div>
              <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString('he-IL')}</div>
            </button>
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
              aria-label="סמן כנקרא"
              onClick={() => markAsRead(r.id)}
            >
              נקרא
            </button>
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
              aria-label="מחק"
              onClick={() => deleteNotification(r.id)}
            >
              מחק
            </button>
          </li>
        ))}
      </ul>

      {read.length > 0 ? <h3 className="mt-4 mb-1 font-semibold">נקראו</h3> : null}
      <ul>
        {read.map((r) => (
          <li key={r.id} className="flex items-center gap-2 rounded border p-2 mb-2 bg-white opacity-75">
            <input
              type="checkbox"
              aria-label={`בחר התראה ${r.type}`}
              checked={!!selected[r.id]}
              onChange={(e) => toggleSelect(r.id, e.target.checked)}
            />
            <button
              type="button"
              className="flex-1 text-right"
              onClick={() => onOpen(r)}
              aria-label="פתח"
            >
              <div className="text-sm">{r.type}</div>
              <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString('he-IL')}</div>
            </button>
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
              aria-label="מחק"
              onClick={() => deleteNotification(r.id)}
            >
              מחק
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
          aria-label="דף קודם"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          קודם
        </button>
        <div className="text-sm">עמוד {page + 1}</div>
        <button
          type="button"
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
          aria-label="דף הבא"
          onClick={() => setPage((p) => p + 1)}
          disabled={rows.length < pageSize}
        >
          הבא
        </button>
      </div>
    </div>
  );
}


