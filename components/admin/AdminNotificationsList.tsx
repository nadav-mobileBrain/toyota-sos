'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { Check, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PermissionPrompt } from '@/components/notifications/PermissionPrompt';
import dayjs from 'dayjs';

type NotificationRow = {
  id: string;
  type: string;
  payload: {
    title?: string;
    body?: string;
    url?: string;
    [key: string]: any;
  };
  read: boolean;
  created_at: string;
};

export function AdminNotificationsList() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications?pageSize=10');
      const json = await res.json();
      if (json.data) {
        setRows(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, read: true }),
      });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, read: true } : r))
      );
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
      setRows((prev) => prev.map((r) => ({ ...r, read: true })));
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const deleteAll = async () => {
    try {
      await fetch('/api/admin/notifications', {
        method: 'DELETE',
      });
      setRows([]);
    } catch (err) {
      console.error('Failed to delete all', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="w-full bg-white">
      <div className="p-3 border-b border-slate-100">
        <PermissionPrompt />
      </div>

      {rows.length === 0 ? (
        <div className="text-center p-4 text-slate-500 text-sm">
          אין התראות חדשות
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-white gap-2">
            <span className="text-xs font-medium text-slate-500">
              התראות אחרונות
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-6 text-[10px] text-toyota-blue hover:text-toyota-blue/80 px-2"
              >
                קרא הכל
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteAll}
                className="h-6 text-[10px] text-red-500 hover:text-red-600 px-2"
                title="מחק הכל"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <ScrollArea className="h-[300px] bg-white">
            <div className="flex flex-col bg-white">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    'flex flex-col gap-1 p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors text-right dir-rtl',
                    !row.read ? 'bg-blue-50/50' : 'bg-white'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <p
                        className={cn(
                          'text-sm font-medium text-slate-900',
                          !row.read && 'text-toyota-blue'
                        )}
                      >
                        {row.payload.title || 'התראה'}
                      </p>
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {row.payload.body}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {dayjs(row.created_at).format('DD/MM/YYYY HH:mm')}
                      </p>
                    </div>
                    {!row.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-slate-300 hover:text-toyota-blue hover:bg-blue-50"
                        onClick={() => markAsRead(row.id)}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
