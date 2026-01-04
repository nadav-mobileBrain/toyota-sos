'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type AuditRow = {
  id: string;
  task_id: string;
  actor_id: string | null;
  action: 'created' | 'updated' | string;
  changed_at: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Record<string, { from: unknown; to: unknown }> | null;
  actor?: { name: string; email: string } | null;
  merged_actions?: AuditRow[];
};

type ProfilesMap = Record<string, string>;

const FIELD_LABELS: Record<string, string> = {
  type: 'סוג משימה',
  status: 'סטטוס',
  priority: 'עדיפות',
  address: 'כתובת',
  details: 'תיאור',
  advisor_name: 'שם יועץ',
  advisor_color: 'צבע יועץ',
  estimated_start: 'תאריך/שעת ביצוע',
  estimated_end: 'שעת סיום משוערת',
  client_id: 'לקוח',
  vehicle_id: 'רכב סוכנות',
  client_vehicle_id: 'רכב לקוח',
  phone: 'טלפון',
  created_at: 'זמן יצירה',
  distance_from_garage: 'מרחק מהסוכנות',
  is_lead: 'נהג מוביל?',
  driver_name: 'שם הנהג',
  stop_index: 'מספר עצירה',
};

const HIDDEN_FIELDS = new Set(['lat', 'lng', 'distance_from_garage']);

function formatDateHeIL(ts: string) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    // If it's just a date (like estimated_start usually is when saved as date)
    return d.toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function classifyChange(v: { from: unknown; to: unknown }) {
  if (v.from === undefined || v.from === null) return 'added';
  if (v.to === undefined || v.to === null) return 'removed';
  if (JSON.stringify(v.from) !== JSON.stringify(v.to)) return 'modified';
  return 'same';
}

const actionLabels: Record<string, string> = {
  created: 'נוצר',
  updated: 'עודכן',
  assigned: 'הקצאת נהג',
  unassigned: 'ביטול הקצאה',
  stop_added: 'נוספה עצירה',
  stop_updated: 'עודכנה עצירה',
  stop_removed: 'הוסרה עצירה',
};

export function AuditFeed({
  taskId,
  pageSize = 20,
}: {
  taskId?: string | null;
  pageSize?: number;
}) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [lookups, setLookups] = useState<{
    clients: ProfilesMap;
    vehicles: ProfilesMap;
    clientVehicles: ProfilesMap;
    drivers: ProfilesMap;
    admins: ProfilesMap;
  }>({
    clients: {},
    vehicles: {},
    clientVehicles: {},
    drivers: {},
    admins: {},
  });
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [query, setQuery] = useState<string>('');

  const fetchLookups = useCallback(async () => {
    try {
      const [
        clientsRes,
        vehiclesRes,
        clientVehiclesRes,
        driversRes,
        adminsRes,
      ] = await Promise.all([
        fetch('/api/admin/clients'),
        fetch('/api/admin/vehicles'),
        fetch('/api/admin/clients-vehicles'),
        fetch('/api/admin/drivers'),
        fetch('/api/admin/admins'),
      ]);

      const [clients, vehicles, clientVehicles, drivers, admins] =
        await Promise.all([
          clientsRes.ok ? clientsRes.json() : Promise.resolve([]),
          vehiclesRes.ok ? vehiclesRes.json() : Promise.resolve([]),
          clientVehiclesRes.ok ? clientVehiclesRes.json() : Promise.resolve([]),
          driversRes.ok ? driversRes.json() : Promise.resolve([]),
          adminsRes.ok ? adminsRes.json() : Promise.resolve([]),
        ]);

      const clientMap: ProfilesMap = {};
      const clientsData = clients?.data || clients || [];
      if (Array.isArray(clientsData)) {
        clientsData.forEach((c: any) => {
          if (c.id) clientMap[c.id] = c.name || c.email || c.id;
        });
      }

      const vehicleMap: ProfilesMap = {};
      const vehiclesData = vehicles?.data || vehicles || [];
      if (Array.isArray(vehiclesData)) {
        vehiclesData.forEach((v: any) => {
          if (v.id)
            vehicleMap[v.id] = `${v.license_plate} ${v.model || ''}`.trim();
        });
      }

      const clientVehicleMap: ProfilesMap = {};
      const clientVehiclesData = clientVehicles?.data || clientVehicles || [];
      if (Array.isArray(clientVehiclesData)) {
        clientVehiclesData.forEach((v: any) => {
          if (v.id)
            clientVehicleMap[v.id] = `${v.license_plate} ${
              v.model || ''
            }`.trim();
        });
      }

      const driverMap: ProfilesMap = {};
      const driversData = drivers?.data || drivers || [];
      if (Array.isArray(driversData)) {
        driversData.forEach((d: any) => {
          if (d.id) driverMap[d.id] = d.name || d.email || d.id;
        });
      }

      const adminMap: ProfilesMap = {};
      const adminsData = admins?.data || admins || [];
      if (Array.isArray(adminsData)) {
        adminsData.forEach((a: any) => {
          if (a.id) adminMap[a.id] = a.name || a.email || a.id;
        });
      }

      setLookups({
        clients: clientMap,
        vehicles: vehicleMap,
        clientVehicles: clientVehicleMap,
        drivers: driverMap,
        admins: adminMap,
      });
    } catch {
      // ignore errors
    }
  }, []);

  useEffect(() => {
    fetchLookups();
  }, [fetchLookups]);

  const resolveValue = (key: string, val: unknown) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'כן' : 'לא';

    // If it's a diff object {from, to}, extract the "to" or "from" depending on context
    // but in resolveValue we usually want the simple value.
    if (typeof val === 'object' && val !== null) {
      const v = val as { from?: unknown; to?: unknown };
      if ('to' in v || 'from' in v) {
        return resolveValue(key, v.to !== undefined ? v.to : v.from);
      }
      return JSON.stringify(val);
    }

    const sVal = String(val).toLowerCase();

    if (key === 'client_id') {
      const entry = Object.entries(lookups.clients).find(
        ([id]) => id.toLowerCase() === sVal
      );
      if (entry) return entry[1];
    }
    if (key === 'vehicle_id') {
      const entry = Object.entries(lookups.vehicles).find(
        ([id]) => id.toLowerCase() === sVal
      );
      if (entry) return entry[1];
    }
    if (key === 'client_vehicle_id') {
      const entry = Object.entries(lookups.clientVehicles).find(
        ([id]) => id.toLowerCase() === sVal
      );
      if (entry) return entry[1];
    }
    if (key === 'driver_id' || key === 'driver_name') {
      const entry = Object.entries(lookups.drivers).find(
        ([id]) => id.toLowerCase() === sVal
      );
      if (entry) return entry[1];
      // driver_name might already be the name string in the diff
      if (
        key === 'driver_name' &&
        val &&
        typeof val === 'string' &&
        val.length > 5
      )
        return val;
    }
    if (key === 'updated_by' || key === 'created_by') {
      // Try to find in admins or drivers
      const adminEntry = Object.entries(lookups.admins).find(
        ([id]) => id.toLowerCase() === sVal
      );
      if (adminEntry) return adminEntry[1];

      const driverEntry = Object.entries(lookups.drivers).find(
        ([id]) => id.toLowerCase() === sVal
      );
      if (driverEntry) return driverEntry[1];

      // If we can't find the name, just return the ID (don't format as date)
      return sVal;
    }

    if (
      key.includes('date') ||
      key.includes('start') ||
      key.includes('_at') ||
      key.includes('end')
    ) {
      if (sVal.includes('T') || sVal.includes('-')) return formatDateHeIL(sVal);
    }
    return sVal.replace(/^"|"$/g, '');
  };

  const loadPage = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const offset = p * pageSize;
        const url = taskId
          ? `/api/admin/tasks/${taskId}/audit?limit=${pageSize}&offset=${offset}`
          : `/api/admin/audit?limit=${pageSize}&offset=${offset}`;

        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.status === 401) {
          setError('לא מורשה');
          setRows([]);
          return;
        }
        if (!res.ok)
          throw new Error(await res.text().catch(() => 'שגיאה בטעינת לוג'));
        const json = await res.json();
        const data = (json?.data as AuditRow[]) || [];
        setRows(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'שגיאה בטעינה';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [pageSize, taskId]
  );

  useEffect(() => {
    loadPage(page);
  }, [page, loadPage]);

  const filtered = useMemo(() => {
    let list = rows;
    if (actionFilter !== 'all') {
      list = list.filter((r) => r.action === actionFilter);
    }

    // Filter out updates that only contain hidden technical fields
    list = list.filter((r) => {
      if (r.action !== 'updated' || !r.diff) return true;
      const keys = Object.keys(r.diff);
      const hasVisibleChanges = keys.some(
        (k) => !HIDDEN_FIELDS.has(k) && k !== 'deleted_at'
      );
      return hasVisibleChanges;
    });

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

  const grouped = useMemo(() => {
    const creationMap = new Map<string, AuditRow>();
    const result: AuditRow[] = [];

    // Find all 'created' actions first to use as anchors
    filtered.forEach((r) => {
      if (r.action === 'created') creationMap.set(r.task_id, r);
    });

    filtered.forEach((r) => {
      // If it's an assignment/unassignment that happened very close to creation
      if (r.action === 'assigned' || r.action === 'unassigned') {
        const creation = creationMap.get(r.task_id);
        if (creation) {
          const creationTime = new Date(creation.changed_at).getTime();
          const actionTime = new Date(r.changed_at).getTime();
          // Within 10 seconds
          if (Math.abs(creationTime - actionTime) < 10000) {
            if (!creation.merged_actions) creation.merged_actions = [];

            // De-duplicate assignments for same driver
            const isDuplicate = creation.merged_actions.some(
              (ma) =>
                ma.action === r.action &&
                JSON.stringify(ma.diff) === JSON.stringify(r.diff)
            );

            if (!isDuplicate) {
              creation.merged_actions.push(r);
            }
            return; // Skip adding this as a separate row
          }
        }
      }
      result.push(r);
    });

    return result;
  }, [filtered]);

  return (
    <section dir="rtl" aria-label="פיד שינויים" className="w-full max-w-3xl">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm" htmlFor="audit-action-filter">
            סינון פעולה
          </label>
          <select
            id="audit-action-filter"
            className="rounded border border-gray-300 p-2 text-sm"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">הכל</option>
            <option value="created">נוצר</option>
            <option value="updated">עודכן</option>
            <option value="assigned">הקצאה</option>
            <option value="unassigned">ביטול הקצאה</option>
            <option value="stop_added">עצירה חדשה</option>
            <option value="stop_updated">עדכון עצירה</option>
            <option value="stop_removed">הסרת עצירה</option>
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
      {error ? (
        <div role="alert" className="text-red-600 text-sm">
          {error}
        </div>
      ) : null}
      {!loading && !error && filtered.length === 0 ? (
        <div className="text-sm text-gray-500">אין שינויים להצגה.</div>
      ) : null}

      <ul className="space-y-3">
        {grouped.map((r) => {
          // Attempt to infer actor_id if missing (e.g. created/updated via service role before trigger fix)
          let inferredActorId = r.actor_id;
          if (!inferredActorId) {
            if (
              r.action === 'created' &&
              r.after &&
              typeof r.after.created_by === 'string'
            ) {
              inferredActorId = r.after.created_by;
            } else if (
              r.action === 'updated' &&
              r.after &&
              typeof r.after.updated_by === 'string'
            ) {
              inferredActorId = r.after.updated_by;
            }
          }

          const actor =
            r.actor?.name ||
            r.actor?.email ||
            (inferredActorId && lookups.admins[inferredActorId]) ||
            (inferredActorId && lookups.drivers[inferredActorId]) ||
            inferredActorId ||
            '—';
          const when = formatDateHeIL(r.changed_at);
          const diff = r.diff || {};
          const keys = Object.keys(diff);

          // Check for deletion (soft delete)
          const isDeletion =
            keys.includes('deleted_at') &&
            diff.deleted_at &&
            classifyChange(
              diff.deleted_at as { from: unknown; to: unknown }
            ) === 'added';

          // When a task is deleted, we want to show some context fields even if they didn't change
          const deletionContextFields = ['type', 'client_id'];
          const displayKeys = isDeletion
            ? [
                ...deletionContextFields.filter(
                  (f) => r.before?.[f] || r.after?.[f]
                ),
                ...keys.filter(
                  (k) => k !== 'deleted_at' && !HIDDEN_FIELDS.has(k)
                ),
              ]
            : keys.filter((k) => !HIDDEN_FIELDS.has(k));

          if (
            r.action === 'created' ||
            r.action === 'assigned' ||
            r.action === 'unassigned'
          ) {
            const displayFields: Record<string, string[]> = {
              created: [
                'type',
                'created_at',
                'estimated_start',
                'client_id',
                'client_vehicle_id',
                'vehicle_id',
                'advisor_name',
                'address',
              ],
              assigned: ['driver_name', 'is_lead'],
              unassigned: ['driver_name', 'is_lead'],
            };
            const fields = displayFields[r.action] || [];

            return (
              <li key={r.id} className="rounded border bg-white p-3 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm border-b pb-2">
                  <span className="font-bold text-blue-700">{actor}</span>
                  <span>•</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-semibold',
                      r.action === 'created'
                        ? 'bg-blue-100 text-blue-800'
                        : r.action === 'assigned'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-orange-100 text-orange-800'
                    )}
                  >
                    {actionLabels[r.action] || r.action}
                  </span>
                  {!taskId && (
                    <>
                      <span>•</span>
                      <span className="text-gray-500 font-mono text-xs">
                        משימה: {r.task_id.slice(0, 8)}
                      </span>
                    </>
                  )}
                  <span className="mr-auto text-gray-400 text-xs">{when}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {fields.map((k) => {
                    // ... same logic ...
                    let val = r.after?.[k];
                    if (val === undefined || val === null) {
                      val = r.before?.[k];
                    }
                    if ((val === undefined || val === null) && r.diff?.[k]) {
                      const d = r.diff[k] as { to?: unknown; from?: unknown };
                      val = d.to !== undefined && d.to !== null ? d.to : d.from;
                    }
                    if (
                      val === undefined ||
                      val === null ||
                      val === '' ||
                      val === '—'
                    )
                      return null;

                    const resolved = resolveValue(k, val);
                    if (resolved === '—') return null;

                    return (
                      <div
                        key={k}
                        className="flex justify-between border-b border-gray-50 py-1"
                      >
                        <span className="text-gray-500">
                          {FIELD_LABELS[k] || k}:
                        </span>
                        <span className="font-medium">{resolved}</span>
                      </div>
                    );
                  })}

                  {/* Merged Actions (Drivers) */}
                  {r.merged_actions?.map((m) => {
                    const driverName = resolveValue(
                      'driver_name',
                      m.diff?.driver_name
                    );
                    const isLead = resolveValue('is_lead', m.diff?.is_lead);
                    return (
                      <div
                        key={m.id}
                        className="col-span-1 sm:col-span-2 flex justify-between border-b border-blue-50 bg-blue-50/30 py-1 px-2 mt-1 rounded"
                      >
                        <span className="text-blue-600 font-semibold">
                          הקצאת נהג:
                        </span>
                        <span className="font-medium">
                          {driverName} {isLead === 'כן' ? '(מוביל)' : '(משנה)'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          }

          return (
            <li key={r.id} className="rounded border bg-white p-3 shadow-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-sm border-b pb-1">
                <span className="font-semibold">{actor}</span>
                <span>•</span>
                <span className={cn(isDeletion && 'text-red-600 font-bold')}>
                  {isDeletion
                    ? 'המשימה נמחקה'
                    : actionLabels[r.action] || r.action}
                </span>
                {!taskId && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600 font-mono text-xs">
                      משימה: {r.task_id.slice(0, 8)}
                    </span>
                  </>
                )}
                <span className="mr-auto text-gray-400 text-xs">{when}</span>
              </div>
              {displayKeys.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm rtl:text-right">
                    <thead>
                      <tr className="text-gray-600 border-b">
                        <th className="p-1 text-right">שדה</th>
                        <th className="p-1 text-right">לפני</th>
                        <th className="p-1 text-right">אחרי</th>
                        <th className="p-1 text-right">מצב</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayKeys.map((k) => {
                        const rec = (
                          diff as Record<string, { from: unknown; to: unknown }>
                        )[k] || { from: r.before?.[k], to: r.after?.[k] };

                        const kind =
                          isDeletion && deletionContextFields.includes(k)
                            ? 'same'
                            : classifyChange(rec);

                        const kindLabel =
                          kind === 'added'
                            ? 'הוסף'
                            : kind === 'removed'
                            ? 'הוסר'
                            : kind === 'modified'
                            ? 'שונה'
                            : 'ללא שינוי';

                        // For deletion context, we just want to show what was there
                        const fromVal =
                          isDeletion && deletionContextFields.includes(k)
                            ? rec.from || rec.to
                            : rec.from;
                        const toVal =
                          isDeletion && deletionContextFields.includes(k)
                            ? null
                            : rec.to;

                        return (
                          <tr key={k} className="border-t border-gray-50">
                            <td className="p-1 text-xs font-medium">
                              {FIELD_LABELS[k] || k}
                            </td>
                            <td className="p-1 text-[11px] text-gray-500 italic">
                              {resolveValue(k, fromVal)}
                            </td>
                            <td className="p-1 text-[11px] text-gray-800 font-medium">
                              {toVal !== null ? resolveValue(k, toVal) : '—'}
                            </td>
                            <td className="p-1 text-xs">
                              <span
                                className={
                                  kind === 'added'
                                    ? 'text-green-600'
                                    : kind === 'removed'
                                    ? 'text-red-600'
                                    : kind === 'modified'
                                    ? 'text-yellow-600'
                                    : 'text-gray-400'
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
                <div className="text-xs text-gray-500 mt-1 italic">
                  אין פירוט לשינוי זה.
                </div>
              )}
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
