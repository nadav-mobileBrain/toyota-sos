'use client';

import React from 'react';

export function DrilldownModal({
  open,
  title,
  rows,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  title: string;
  rows: any[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div dir="rtl" className="relative z-10 max-h-[80vh] w-[min(96vw,1000px)] overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">
            סגירה
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-3">
          {loading ? (
            <div className="p-6 text-center text-gray-600">טוען...</div>
          ) : error ? (
            <div className="p-6 text-center text-red-600">שגיאה: {error}</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-gray-600">אין נתונים להצגה</div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="sticky top-0 bg-gray-100">
                <tr>
                  <th className="px-2 py-2 font-semibold">סוג משימה</th>
                  <th className="px-2 py-2 font-semibold">סטטוס</th>
                  <th className="px-2 py-2 font-semibold">עדיפות</th>
                  <th className="px-2 py-2 font-semibold">נהג מוביל</th>
                  <th className="px-2 py-2 font-semibold">נוצר</th>
                  <th className="px-2 py-2 font-semibold">עודכן</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-2">{r.type || r.title || r.id}</td>
                    <td className="px-2 py-2">{r.status || '—'}</td>
                    <td className="px-2 py-2">{r.priority || '—'}</td>
                    <td className="px-2 py-2">{r.driver_name || '—'}</td>
                    <td className="px-2 py-2">{r.created_at?.slice(0, 19).replace('T', ' ') || '—'}</td>
                    <td className="px-2 py-2">{r.updated_at?.slice(0, 19).replace('T', ' ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}


