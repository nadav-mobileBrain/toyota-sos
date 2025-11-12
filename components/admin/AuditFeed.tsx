'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

type AuditRow = {
  id: string;
  task_id: string;
  actor_id: string | null;
  action: 'created' | 'updated' | string;
  changed_at: string;
  before: any | null;
  after: any | null;
  diff: Record<string, { from: any; to: any }> | null;
};

type ProfilesMap = Record<string, string>;

function formatDateHeIL(ts: string) {
  try {
    return new Date(ts).toLocaleString('he-IL');
  } catch {
    return ts;
  }
}

function classifyChange(v: { from: any; to: any }) {
  if (v.from === undefined || v.from === null) return 'added';
  if (v.to === undefined || v.to === null) return 'removed';
  if (JSON.stringify(v.from) !== JSON.stringify(v.to)) return 'modified';
  return 'same';
}

export function AuditFeed({
  taskId,
  pageSize = 20,
}: {
  taskId: string;
  pageSize?: number;
}) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [actorLookup, setActorLookup] = useState<ProfilesMap>({});
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [query, setQuery] = useState<string>('');

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const offset = p * pageSize;
      const res = await fetch(`/api/admin/tasks/${taskId}/audit?limit=${pageSize}&offset=${offset}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status === 401) {
        setError('לא מורשה');
        setRows([]);
        return;
      }
      if (!res.ok) throw new Error(await res.text().catch(() => 'שגיאה בטעינת לוג'));
      const json = await res.json();
      const data = (json?.data as AuditRow[]) || [];
      setRows(data);
      // fetch actors display names (best-effort)
      const ids = Array.from(new Set(data.map((r) => r.actor_id).filter(Boolean))) as string[];
      if (ids.length > 0) {
        try {
          const q = encodeURIComponent(`in.(${ids.join(',')})`);
          const profRes = await fetch(
            `${(globalThis as any).__SUPABASE_URL__ ?? ''}/rest/v1/profiles?select=id,name,email&id=${q}`,
            { headers: { apikey: (globalThis as any).__SUPABASE_ANON__ ?? '' } }
          );
          if (profRes.ok) {
            const arr = await profRes.json();
            const map: ProfilesMap = {};
            for (const p of arr) {
              map[p.id] = p.name || p.email || p.id;
            }
            setActorLookup(map);
          }
        } catch {
          // ignore
        }
      } else {
        setActorLookup({});
      }
    } catch (e: any) {
      setError(e?.message || 'שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  }, [pageSize, taskId]);

  useEffect(() => {
    loadPage(page);
  }, [page, loadPage]);

  const filtered = useMemo(() => {
    let list = rows;
    if (actionFilter !== 'all') {
      list = list.filter((r) => r.action === actionFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => {
        const b = r.before ? JSON.stringify(r.before).toLowerCase() : '';
        const a = r.after ? JSON.stringify(r.after).toLowerCase() : '';
        const d = r.diff ? JSON.stringify(r.diff).toLowerCase() : '';
        return b.includes(q) || a.includes(q) || d.includes(q);
      });
    }
    return list;
  }, [rows, actionFilter, query]);

  const copyJson = (payload: any) => {
    try {
      const s = JSON.stringify(payload, null, 2);
      (navigator.clipboard?.writeText as any)?.(s);
    } catch {
      // ignore
    }
  };

  return (
    <section dir="rtl" aria-label="פיד שינויים" className="w-full max-w-3xl">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm" htmlFor="audit-action-filter">סינון פעולה</label>
          <select
            id="audit-action-filter"
            className="rounded border border-gray-300 p-2 text-sm"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">הכל</option>
            <option value="created">נוצר</option>
            <option value="updated">עודכן</option>
          </select>
        </div>
        <input
          aria-label="חפש"
          className="rounded border border-gray-300 p-2 text-sm"
          placeholder="חיפוש בדיפ/שדות..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? <div role="status">טוען...</div> : null}
      {error ? <div role="alert" className="text-red-600 text-sm">{error}</div> : null}
      {!loading && !error && filtered.length === 0 ? (
        <div className="text-sm text-gray-500">אין שינויים להצגה.</div>
      ) : null}

      <ul className="space-y-3">
        {filtered.map((r) => {
          const actor = (r.actor_id && actorLookup[r.actor_id]) || r.actor_id || '—';
          const when = formatDateHeIL(r.changed_at);
          const diff = r.diff || {};
          const keys = Object.keys(diff);
          return (
            <li key={r.id} className="rounded border bg-white p-3 shadow-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{actor}</span>
                <span>•</span>
                <span>{r.action === 'created' ? 'נוצר' : r.action === 'updated' ? 'עודכן' : r.action}</span>
                <span>•</span>
                <time dateTime={r.changed_at}>{when}</time>
              </div>
              {keys.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm rtl:text-right">
                    <thead>
                      <tr className="text-gray-600">
                        <th className="p-1 text-right">שדה</th>
                        <th className="p-1 text-right">לפני</th>
                        <th className="p-1 text-right">אחרי</th>
                        <th className="p-1 text-right">מצב</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((k) => {
                        const rec = (diff as any)[k] as { from: any; to: any };
                        const kind = classifyChange(rec);
                        const kindLabel = kind === 'added' ? 'הוסף' : kind === 'removed' ? 'הוסר' : kind === 'modified' ? 'שונה' : 'ללא שינוי';
                        return (
                          <tr key={k} className="border-t">
                            <td className="p-1 font-mono text-xs">{k}</td>
                            <td className="p-1 font-mono text-[11px] text-gray-600 break-all">{JSON.stringify(rec.from)}</td>
                            <td className="p-1 font-mono text-[11px] text-gray-800 break-all">{JSON.stringify(rec.to)}</td>
                            <td className="p-1 text-xs">
                              <span
                                className={
                                  kind === 'added'
                                    ? 'rounded bg-green-100 px-2 py-0.5 text-green-800'
                                    : kind === 'removed'
                                    ? 'rounded bg-red-100 px-2 py-0.5 text-red-800'
                                    : kind === 'modified'
                                    ? 'rounded bg-yellow-100 px-2 py-0.5 text-yellow-800'
                                    : 'rounded bg-gray-100 px-2 py-0.5 text-gray-700'
                                }
                              >
                                {kindLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-gray-500">אין דיפ לשינוי זה.</div>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                  aria-label="העתק JSON לפני"
                  onClick={() => copyJson(r.before)}
                >
                  העתק לפני
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                  aria-label="העתק JSON אחרי"
                  onClick={() => copyJson(r.after)}
                >
                  העתק אחרי
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="דף קודם"
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          קודם
        </button>
        <div className="text-sm">עמוד {page + 1}</div>
        <button
          type="button"
          aria-label="דף הבא"
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => setPage((p) => p + 1)}
          disabled={rows.length < pageSize}
        >
          הבא
        </button>
      </div>
    </section>
  );
}

export default AuditFeed;


