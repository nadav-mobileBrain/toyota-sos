'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Driver, Client, Vehicle, Task, TaskPriority, TaskStatus, TaskType } from './TasksBoard';
import { trackFormSubmitted } from '@/lib/events';
import { useFeatureFlag } from '@/lib/useFeatureFlag';
import { FLAG_MULTI_DRIVER, FLAG_PDF_GENERATION } from '@/lib/flagKeys';
import { downloadBlob, generateTaskPdfLikeBlob } from '@/utils/pdf';
import { toastSuccess, toastError } from '@/lib/toast';

type Mode = 'create' | 'edit';

interface TaskDialogProps {
  open: boolean;
  mode: Mode;
  task?: Task | null;
  drivers: Driver[];
  clients: Client[];
  vehicles: Vehicle[];
  onOpenChange: (open: boolean) => void;
  onCreated?: (task: Task, leadDriverId?: string, coDriverIds?: string[]) => void;
  onUpdated?: (task: Task) => void;
}

const types: TaskType[] = [
  'pickup_or_dropoff_car',
  'replacement_car_delivery',
  'drive_client_home',
  'drive_client_to_dealership',
  'licence_test',
  'rescue_stuck_car',
  'other',
];
const priorities: TaskPriority[] = ['low', 'medium', 'high'];
const statuses: TaskStatus[] = ['pending', 'in_progress', 'blocked', 'completed'];

export function TaskDialog(props: TaskDialogProps) {
  const { open, onOpenChange, mode, task, drivers, clients, vehicles, onCreated, onUpdated } = props;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feature flags
  const multiDriverEnabled = useFeatureFlag(FLAG_MULTI_DRIVER);
  const pdfEnabled = useFeatureFlag(FLAG_PDF_GENERATION);

  // Form state
  const [clientsLocal, setClientsLocal] = useState<Client[]>(clients);
  const [vehiclesLocal, setVehiclesLocal] = useState<Vehicle[]>(vehicles);
  const [title, setTitle] = useState(task?.title ?? '');
  const [type, setType] = useState<TaskType>(task?.type ?? 'other');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'pending');
  const [details, setDetails] = useState(task?.details ?? '');
  const [estimatedStart, setEstimatedStart] = useState(task?.estimated_start ?? '');
  const [estimatedEnd, setEstimatedEnd] = useState(task?.estimated_end ?? '');
  const [address, setAddress] = useState(task?.address ?? '');
  const [addressQuery, setAddressQuery] = useState(task?.address ?? '');
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string>(task?.client_id ?? '');
  const [vehicleId, setVehicleId] = useState<string>(task?.vehicle_id ?? '');
  const [leadDriverId, setLeadDriverId] = useState<string>('');
  const [coDriverIds, setCoDriverIds] = useState<string[]>([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newVehicleModel, setNewVehicleModel] = useState('');
  const [newVehicleVin, setNewVehicleVin] = useState('');

  useEffect(() => {
    if (open) {
      // Reset on open to initial values
      setError(null);
      setTitle(task?.title ?? '');
      setType(task?.type ?? 'other');
      setPriority(task?.priority ?? 'medium');
      setStatus(task?.status ?? 'pending');
      setDetails(task?.details ?? '');
      setEstimatedStart(task?.estimated_start ?? '');
      setEstimatedEnd(task?.estimated_end ?? '');
      setAddress(task?.address ?? '');
      setAddressQuery(task?.address ?? '');
      setClientId(task?.client_id ?? '');
      setVehicleId(task?.vehicle_id ?? '');
      setLeadDriverId('');
      setCoDriverIds([]);
      setClientsLocal(clients);
      setVehiclesLocal(vehicles);
      setShowAddClient(false);
      setShowAddVehicle(false);
    }
  }, [open, task, clients, vehicles]);

  const coDriversSet = useMemo(() => new Set(coDriverIds), [coDriverIds]);

  const toggleCoDriver = (id: string) => {
    setCoDriverIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return Array.from(s);
    });
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'חובה להזין כותרת';
    if (estimatedStart && estimatedEnd && new Date(estimatedStart) > new Date(estimatedEnd)) {
      return 'שעת התחלה לא יכולה להיות אחרי שעת סיום';
    }
    return null;
  };

  // Address autocomplete (debounced, mock suggestions if no external API)
  useEffect(() => {
    const h = setTimeout(() => {
      const q = (addressQuery || '').trim();
      if (q.length < 3) {
        setAddressSuggestions([]);
        return;
      }
      // Mock suggestions set (RTL examples)
      const pool = [
        'תל אביב-יפו, ישראל',
        'רחוב דיזנגוף 100, תל אביב',
        'רחוב הרצל 10, תל אביב',
        'ירושלים, ישראל',
        'חיפה, ישראל',
        'ראשון לציון, ישראל',
        'בת ים, ישראל',
        'אשדוד, ישראל',
      ];
      const results = pool.filter((s) => s.toLowerCase().includes(q.toLowerCase())).slice(0, 5);
      setAddressSuggestions(results);
    }, 250);
    return () => clearTimeout(h);
  }, [addressQuery]);

  const pickSuggestion = (s: string) => {
    setAddress(s);
    setAddressQuery(s);
    setAddressSuggestions([]);
  };

  const createClient = async () => {
    const name = newClientName.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: newClientPhone || null, email: newClientEmail || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const created: Client = json.data;
      setClientsLocal((prev) => [...prev, created]);
      setClientId(created.id);
      setShowAddClient(false);
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
    } catch (err: any) {
      setError(err?.message || 'יצירת לקוח נכשלה');
    }
  };

  const createVehicle = async () => {
    const license_plate = newVehiclePlate.trim();
    if (!license_plate) return;
    try {
      const res = await fetch('/api/admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_plate, model: newVehicleModel || null, vin: newVehicleVin || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const created: Vehicle = json.data;
      setVehiclesLocal((prev) => [...prev, created]);
      setVehicleId(created.id);
      setShowAddVehicle(false);
      setNewVehiclePlate('');
      setNewVehicleModel('');
      setNewVehicleVin('');
    } catch (err: any) {
      setError(err?.message || 'יצירת רכב נכשלה');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      try {
        trackFormSubmitted({ form: 'TaskDialog', mode, success: false, error_message: v });
      } catch {
        // optional analytics
      }
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'create') {
        const body = {
          title: title.trim(),
          type,
          priority,
          status,
          details: details || null,
          estimated_start: estimatedStart || null,
          estimated_end: estimatedEnd || null,
          address: address || '',
          client_id: clientId || null,
          vehicle_id: vehicleId || null,
          lead_driver_id: leadDriverId || null,
          co_driver_ids: coDriverIds,
        };
        const res = await fetch('/api/admin/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(t || 'יצירת משימה נכשלה');
        }
        const json = await res.json();
        const created: Task = json.data;
        toastSuccess('המשימה נוצרה בהצלחה!');
        onCreated?.(created, leadDriverId || undefined, coDriverIds);
        try {
          trackFormSubmitted({ form: 'TaskDialog', mode, success: true, task_id: created.id });
        } catch {
          // optional
        }
        onOpenChange(false);
      } else {
        if (!task) return;
        const update: Partial<Task> = {
          title: title.trim(),
          type,
          priority,
          status,
          details: details || null,
          estimated_start: estimatedStart || null,
          estimated_end: estimatedEnd || null,
          address: address || '',
          client_id: clientId || null,
          vehicle_id: vehicleId || null,
        };
        const res = await fetch(`/api/admin/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
            throw new Error(t || 'עדכון משימה נכשל');
        }
        const json = await res.json();
        const updated: Task = json.data;
        toastSuccess('המשימה עודכנה בהצלחה!');
        onUpdated?.(updated);
        try {
          trackFormSubmitted({ form: 'TaskDialog', mode, success: true, task_id: updated.id });
        } catch {
          // optional
        }
        onOpenChange(false);
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'שגיאה';
      setError(errorMessage);
      toastError(errorMessage);
      try {
        trackFormSubmitted({ form: 'TaskDialog', mode, success: false, task_id: task?.id, error_message: err?.message });
      } catch {
        // optional
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-xl" role="dialog" aria-modal="true">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{mode === 'create' ? 'יצירת משימה' : 'עריכת משימה'}</h2>
          <button className="text-gray-500 hover:text-gray-700" onClick={() => onOpenChange(false)} aria-label="סגור">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">כותרת</span>
            <input className="rounded border border-gray-300 p-2" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">סוג</span>
            <select className="rounded border border-gray-300 p-2" value={type} onChange={(e) => setType(e.target.value as TaskType)}>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">עדיפות</span>
            <select className="rounded border border-gray-300 p-2" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {priorities.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">סטטוס</span>
            <select className="rounded border border-gray-300 p-2" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="col-span-1 md:col-span-2 flex flex-col gap-1">
            <span className="text-sm font-medium">תיאור</span>
            <textarea className="rounded border border-gray-300 p-2" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">שעת התחלה מוערכת</span>
            <input className="rounded border border-gray-300 p-2" type="datetime-local" value={estimatedStart} onChange={(e) => setEstimatedStart(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">שעת סיום מוערכת</span>
            <input className="rounded border border-gray-300 p-2" type="datetime-local" value={estimatedEnd} onChange={(e) => setEstimatedEnd(e.target.value)} />
          </label>

          <label className="col-span-1 md:col-span-2 flex flex-col gap-1">
            <span className="text-sm font-medium">כתובת</span>
            <input
              className="rounded border border-gray-300 p-2"
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.target.value)}
              placeholder="הקלד כתובת..."
            />
            {addressSuggestions.length > 0 && (
              <div className="mt-1 rounded border border-gray-200 bg-white shadow-sm">
                {addressSuggestions.map((s) => (
                  <button
                    type="button"
                    key={s}
                    className="block w-full text-right px-3 py-2 text-sm hover:bg-gray-50"
                    onClick={() => pickSuggestion(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">לקוח</span>
            <div className="flex gap-2">
              <select className="rounded border border-gray-300 p-2 flex-1" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">—</option>
              {clientsLocal.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              </select>
              <button type="button" className="rounded border border-gray-300 px-2 text-xs" onClick={() => setShowAddClient((v) => !v)}>
                חדש
              </button>
            </div>
            {showAddClient && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <input className="rounded border border-gray-300 p-2 col-span-1" placeholder="שם" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
                <input className="rounded border border-gray-300 p-2 col-span-1" placeholder="טלפון" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} />
                <input className="rounded border border-gray-300 p-2 col-span-1" placeholder="אימייל" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
                <div className="col-span-3 flex justify-end gap-2">
                  <button type="button" className="rounded border border-gray-300 px-2 text-xs" onClick={() => setShowAddClient(false)}>בטל</button>
                  <button type="button" className="rounded bg-toyota-primary px-2 py-1 text-xs font-semibold text-white" onClick={createClient}>צור</button>
                </div>
              </div>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">רכב</span>
            <div className="flex gap-2">
              <select className="rounded border border-gray-300 p-2 flex-1" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">—</option>
              {vehiclesLocal.map((v) => (
                <option key={v.id} value={v.id}>{v.license_plate} · {v.model}</option>
              ))}
              </select>
              <button type="button" className="rounded border border-gray-300 px-2 text-xs" onClick={() => setShowAddVehicle((v) => !v)}>
                חדש
              </button>
            </div>
            {showAddVehicle && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <input className="rounded border border-gray-300 p-2 col-span-1" placeholder="מספר רישוי" value={newVehiclePlate} onChange={(e) => setNewVehiclePlate(e.target.value)} />
                <input className="rounded border border-gray-300 p-2 col-span-1" placeholder="דגם" value={newVehicleModel} onChange={(e) => setNewVehicleModel(e.target.value)} />
                <input className="rounded border border-gray-300 p-2 col-span-1" placeholder="VIN" value={newVehicleVin} onChange={(e) => setNewVehicleVin(e.target.value)} />
                <div className="col-span-3 flex justify-end gap-2">
                  <button type="button" className="rounded border border-gray-300 px-2 text-xs" onClick={() => setShowAddVehicle(false)}>בטל</button>
                  <button type="button" className="rounded bg-toyota-primary px-2 py-1 text-xs font-semibold text-white" onClick={createVehicle}>צור</button>
                </div>
              </div>
            )}
          </label>

          {/* Drivers */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">נהג מוביל</span>
              <select className="rounded border border-gray-300 p-2" value={leadDriverId} onChange={(e) => setLeadDriverId(e.target.value)}>
                <option value="">—</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name || d.email}</option>
                ))}
              </select>
            </label>

            {multiDriverEnabled && (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">נהגי משנה</span>
                <div className="max-h-28 overflow-auto rounded border border-gray-200 p-2">
                  {drivers.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={coDriversSet.has(d.id)}
                        onChange={() => toggleCoDriver(d.id)}
                      />
                      <span>{d.name || d.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="col-span-1 md:col-span-2 mt-2 flex items-center justify-end gap-2">
            {pdfEnabled && (
              <button
                type="button"
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                onClick={() => {
                  const payload = {
                    title,
                    type,
                    priority,
                    status,
                    details,
                    estimated_start: estimatedStart,
                    estimated_end: estimatedEnd,
                    address,
                    client_id: clientId,
                    vehicle_id: vehicleId,
                  };
                  const blob = generateTaskPdfLikeBlob(payload);
                  downloadBlob(blob, `task-${task?.id || 'new'}.pdf`);
                }}
              >
                ייצוא PDF
              </button>
            )}
            <button type="button" className="rounded border border-gray-300 px-3 py-2 text-sm" onClick={() => onOpenChange(false)} disabled={submitting}>
              ביטול
            </button>
            <button type="submit" className="rounded bg-toyota-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={submitting}>
              {mode === 'create' ? 'צור משימה' : 'שמור שינויים'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


