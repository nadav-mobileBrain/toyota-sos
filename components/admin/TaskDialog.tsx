'use client';

/* eslint-disable max-lines */
import React, { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import dayjs from '@/lib/dayjs';
import type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
  TaskAssignee,
} from '@/types/task';
import type { Driver } from '@/types/user';
import type { Client, Vehicle } from '@/types/entity';
import { trackFormSubmitted } from '@/lib/events';
import { useFeatureFlag } from '@/lib/useFeatureFlag';
import { FLAG_MULTI_DRIVER, FLAG_PDF_GENERATION } from '@/lib/flagKeys';
import { toastSuccess, toastError } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Calendar, PlusIcon, SaveIcon, XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RtlSelectDropdown } from './RtlSelectDropdown';
type Mode = 'create' | 'edit';
type StopForm = {
  clientId: string;
  clientQuery: string;
  address: string;
  advisorName: string;
};

// Validation schema for estimated date (no past dates allowed)
const estimatedDateSchema = z.date().refine((date) => {
  const selectedTime = dayjs(date).startOf('day').valueOf();
  const todayTime = dayjs().startOf('day').valueOf();
  return selectedTime >= todayTime;
}, 'תאריך לא יכול להיות בעבר');

// Validation schema for driver selection (primary vs secondary)
const driverSelectionSchema = z
  .object({
    leadDriverId: z.string().optional().or(z.literal('')),
    coDriverIds: z.array(z.string()),
  })
  .refine(
    (data) =>
      !data.leadDriverId ||
      data.leadDriverId === '' ||
      !data.coDriverIds.includes(data.leadDriverId),
    {
      message: 'אי אפשר לבחור את אותו נהג כנהג מוביל ונהג משנה',
    }
  );

interface TaskDialogProps {
  open: boolean;
  mode: Mode;
  task?: Task | null;
  assignees?: TaskAssignee[];
  drivers: Driver[];
  clients: Client[];
  vehicles: Vehicle[];
  onOpenChange: (open: boolean) => void;
  onCreated?: (
    task: Task,
    leadDriverId?: string,
    coDriverIds?: string[]
  ) => void;
  onUpdated?: (
    task: Task,
    leadDriverId?: string,
    coDriverIds?: string[]
  ) => void;
  onClientCreated?: (client: Client) => void;
  onVehicleCreated?: (vehicle: Vehicle) => void;
}

const types: TaskType[] = [
  'איסוף רכב/שינוע',
  'החזרת רכב/שינוע',
  'הסעת רכב חלופי',
  'הסעת לקוח הביתה',
  'הסעת לקוח למוסך',
  'ביצוע טסט',
  'חילוץ רכב תקוע',
  'אחר',
];
const priorities: TaskPriority[] = ['נמוכה', 'בינונית', 'גבוהה'];
const statuses: TaskStatus[] = ['בהמתנה', 'בעבודה', 'חסומה', 'הושלמה'];
const multiStopTypes: TaskType[] = ['הסעת לקוח הביתה', 'הסעת לקוח למוסך'];
const multiStopAliases = ['drive_client_home', 'drive_client_to_dealership'];
const isMultiStopTaskType = (val: string | null | undefined) => {
  const normalized = (val || '').trim();
  return (
    multiStopTypes.includes(normalized as TaskType) ||
    multiStopAliases.includes(normalized)
  );
};

const statusLabels: Record<TaskStatus, string> = {
  בהמתנה: 'ממתינה לביצוע',
  בעבודה: 'בביצוע',
  חסומה: 'חסומה',
  הושלמה: 'בוצעה',
};

export function TaskDialog(props: TaskDialogProps) {
  const {
    open,
    onOpenChange,
    mode,
    task,
    assignees = [],
    drivers,
    clients,
    vehicles,
    onCreated,
    onUpdated,
    onClientCreated,
    onVehicleCreated,
  } = props;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feature flags
  const multiDriverEnabled = useFeatureFlag(FLAG_MULTI_DRIVER);

  // Form state
  const [clientsLocal, setClientsLocal] = useState<Client[]>(clients);
  const [vehiclesLocal, setVehiclesLocal] = useState<Vehicle[]>(vehicles);
  const [title, setTitle] = useState(task?.title ?? '');
  const [type, setType] = useState<TaskType>(task?.type ?? 'אחר');
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? 'בינונית'
  );
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'בהמתנה');
  const [details, setDetails] = useState(task?.details ?? '');
  const [estimatedDate, setEstimatedDate] = useState<Date>(
    task?.estimated_start ? new Date(task.estimated_start) : new Date()
  );
  const [estimatedDateError, setEstimatedDateError] = useState<string | null>(
    null
  );
  const [estimatedStartTime, setEstimatedStartTime] = useState(
    task?.estimated_start
      ? dayjs(task.estimated_start).format('HH:mm')
      : '09:00'
  );
  const [estimatedEndTime, setEstimatedEndTime] = useState(
    task?.estimated_end ? dayjs(task.estimated_end).format('HH:mm') : '17:00'
  );
  const [address, setAddress] = useState(task?.address ?? '');
  const [addressQuery, setAddressQuery] = useState(task?.address ?? '');
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string>(task?.client_id ?? '');
  const [clientQuery, setClientQuery] = useState<string>('');
  const [vehicleId, setVehicleId] = useState<string>(task?.vehicle_id ?? '');
  const [vehicleQuery, setVehicleQuery] = useState<string>('');
  const [leadDriverId, setLeadDriverId] = useState<string>('');
  const [coDriverIds, setCoDriverIds] = useState<string[]>([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newVehicleModel, setNewVehicleModel] = useState('');
  const [advisorName, setAdvisorName] = useState(task?.advisor_name ?? '');
  const [stops, setStops] = useState<StopForm[]>([]);
  const [activeStopIndex, setActiveStopIndex] = useState(0);

  useEffect(() => {
    setClientsLocal(clients);
  }, [clients]);

  useEffect(() => {
    setVehiclesLocal(vehicles);
  }, [vehicles]);

  // Track previous open state to detect when dialog opens
  const prevOpenRef = React.useRef(open);

  useEffect(() => {
    // Only reset when dialog is newly opened (transitions from false to true)
    const isNewlyOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;

    if (isNewlyOpened) {
      // Reset on open to initial values
      setError(null);
      setTitle(task?.title ?? '');
      setType(task?.type ?? 'אחר');
      setPriority(task?.priority ?? 'בינונית');
      setStatus(task?.status ?? 'בהמתנה');
      setDetails(task?.details ?? '');
      setAdvisorName(task?.advisor_name ?? '');
      setEstimatedDate(
        task?.estimated_start ? new Date(task.estimated_start) : new Date()
      );
      setEstimatedStartTime(
        task?.estimated_start
          ? dayjs(task.estimated_start).format('HH:mm')
          : '09:00'
      );
      setEstimatedEndTime(
        task?.estimated_end
          ? dayjs(task.estimated_end).format('HH:mm')
          : '10:00'
      );
      setAddress(task?.address ?? '');
      setAddressQuery(task?.address ?? '');
      setClientId(task?.client_id ?? '');
      setActiveStopIndex(0);
      const taskType = task?.type ?? '';
      const isMulti = isMultiStopTaskType(taskType);
      if (task?.client_id) {
        const existing = clients.find((c) => c.id === task.client_id);
        setClientQuery(existing?.name ?? '');
        if (isMulti) {
          setStops([
            {
              clientId: task.client_id,
              clientQuery: existing?.name ?? '',
              address: task.address ?? '',
              advisorName: task.advisor_name ?? '',
            },
          ]);
        }
      } else {
        setClientQuery('');
        if (isMulti) {
          setStops([
            {
              clientId: '',
              clientQuery: '',
              address: task?.address ?? '',
              advisorName: task?.advisor_name ?? '',
            },
          ]);
        }
      }
      setVehicleId(task?.vehicle_id ?? '');
      if (task?.vehicle_id) {
        const existingVehicle = vehicles.find((v) => v.id === task.vehicle_id);
        setVehicleQuery(
          existingVehicle
            ? `${existingVehicle.license_plate}${
                existingVehicle.model ? ` · ${existingVehicle.model}` : ''
              }`
            : ''
        );
      } else {
        setVehicleQuery('');
      }
      if (mode === 'edit' && assignees.length > 0) {
        const lead = assignees.find((a) => a.is_lead);
        const co = assignees.filter((a) => !a.is_lead).map((a) => a.driver_id);
        setLeadDriverId(lead?.driver_id ?? '');
        setCoDriverIds(co);
      } else {
        setLeadDriverId('');
        setCoDriverIds([]);
      }
      setShowAddClient(false);
      setShowAddVehicle(false);
      if (!isMulti) {
        setStops([]);
      }
    }
  }, [open, task, mode, assignees, clients, vehicles]);

  const isMultiStopType = useMemo(
    () => isMultiStopTaskType(type),
    [type]
  );

  useEffect(() => {
    if (isMultiStopType) {
      if (stops.length === 0) {
        setStops([
          {
            clientId: clientId || '',
            clientQuery: clientQuery || '',
            address: addressQuery || '',
            advisorName: advisorName || '',
          },
        ]);
      }
    } else if (stops.length > 0) {
      const first = stops[0];
      setClientId(first.clientId);
      setClientQuery(first.clientQuery);
      setAddress(first.address);
      setAddressQuery(first.address);
      setAdvisorName(first.advisorName);
      setStops([]);
    }
  }, [
    isMultiStopType,
    stops.length,
    clientId,
    clientQuery,
    addressQuery,
    advisorName,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!open || mode !== 'edit' || !task?.id || !isMultiStopType) return;

    const fetchStops = async () => {
      try {
        const res = await fetch(`/api/admin/tasks/${task.id}`);
        if (!res.ok) return;
        const json = await res.json();
        const taskStops = json?.data?.task_stops || json?.data?.stops || [];
        if (!Array.isArray(taskStops) || taskStops.length === 0) return;
        const mapped: StopForm[] = taskStops
          .slice()
          .sort(
            (a: any, b: any) =>
              (a?.sort_order ?? 0) - (b?.sort_order ?? 0)
          )
          .map((s: any) => {
            const clientName =
              clientsLocal.find((c) => c.id === s?.client_id)?.name || '';
            return {
              clientId: s?.client_id || '',
              clientQuery: clientName,
              address: s?.address || '',
              advisorName: s?.advisor_name || '',
            };
          });
        if (!cancelled) {
          setStops(mapped);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load task stops', err);
        }
      }
    };
    fetchStops();

    return () => {
      cancelled = true;
    };
  }, [open, mode, task?.id, isMultiStopType, clientsLocal]);

  const clientSuggestions = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return [];
    return clientsLocal
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [clientsLocal, clientQuery]);

  const vehicleSuggestions = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    if (!q) return [];
    return vehiclesLocal
      .filter((v) => {
        const plate = v.license_plate?.toLowerCase() ?? '';
        const model = v.model?.toLowerCase() ?? '';
        return plate.includes(q) || model.includes(q);
      })
      .slice(0, 8);
  }, [vehiclesLocal, vehicleQuery]);

  const getClientSuggestions = React.useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      return clientsLocal
        .filter((c) => c.name.toLowerCase().includes(q))
        .slice(0, 8);
    },
    [clientsLocal]
  );

  const validate = (): string | null => {
    // Validate date
    const dateValidation = estimatedDateSchema.safeParse(estimatedDate);
    if (!dateValidation.success) {
      return dateValidation.error.issues[0].message;
    }

    const startTime = parseInt(estimatedStartTime.split(':')[0]);
    const endTime = parseInt(estimatedEndTime.split(':')[0]);
    if (startTime >= endTime) {
      return 'שעת התחלה לא יכולה להיות אחרי שעת סיום';
    }

    const driverValidation = driverSelectionSchema.safeParse({
      leadDriverId,
      coDriverIds,
    });
    if (!driverValidation.success) {
      return driverValidation.error.issues[0].message;
    }

    if (isMultiStopType) {
      if (stops.length === 0) {
        return 'חובה להוסיף לפחות לקוח אחד עבור סוג משימה זה';
      }
      for (const stop of stops) {
        if (!(stop.clientId || stop.clientQuery.trim())) {
          return 'חובה לבחור לקוח עבור כל עצירה';
        }
        if (!stop.address.trim()) {
          return 'חובה להזין כתובת עבור כל עצירה';
        }
        if (!stop.advisorName.trim()) {
          return 'חובה להזין שם יועץ עבור כל עצירה';
        }
      }
    }

    return null;
  };

  // Address autocomplete using data.gov.il API
  useEffect(() => {
    // Disabled for now
    setAddressSuggestions([]);

    /*
    const controller = new AbortController();
    const h = setTimeout(async () => {
      const q = (addressQuery || '').trim();
      if (q.length < 3) {
        setAddressSuggestions([]);
        return;
      }
      try {
        const res = await fetch(
          `https://data.gov.il/api/3/action/datastore_search?resource_id=9ad3862c-8391-4b2f-84a4-2d4c68625f4b&q=${encodeURIComponent(
            q
          )}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        const records = data?.result?.records ?? [];
        const suggestions = records
          .map((r: Record<string, unknown>) => {
            const street = (
              typeof r['שם_רחוב'] === 'string' ? r['שם_רחוב'] : ''
            ).trim();
            const city = (
              typeof r['שם_ישוב'] === 'string' ? r['שם_ישוב'] : ''
            ).trim();
            if (street && city) return `${street}, ${city}`;
            return street || city;
          })
          .filter(Boolean)
          // Deduplicate
          .filter(
            (val: string, idx: number, arr: string[]) =>
              arr.indexOf(val) === idx
          )
          .slice(0, 5);
        setAddressSuggestions(suggestions);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setAddressSuggestions([]);
        }
      }
    }, 300);
    return () => {
      clearTimeout(h);
      controller.abort();
    };
    */
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
        body: JSON.stringify({
          name,
          phone: newClientPhone || null,
          email: newClientEmail || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const created: Client = json.data;
      setClientsLocal((prev) => [...prev, created]);
      onClientCreated?.(created);
      if (isMultiStopType) {
        setStops((prev) => {
          if (prev.length === 0) {
            return [
              {
                clientId: created.id,
                clientQuery: created.name || '',
                address: '',
                advisorName: '',
              },
            ];
          }
          const idx =
            activeStopIndex >= 0 && activeStopIndex < prev.length
              ? activeStopIndex
              : 0;
          return prev.map((stop, i) =>
            i === idx
              ? {
                  ...stop,
                  clientId: created.id,
                  clientQuery: created.name || '',
                }
              : stop
          );
        });
      } else {
        setClientId(created.id);
        setClientQuery(created.name || '');
      }
      setShowAddClient(false);
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'יצירת לקוח נכשלה');
    }
  };

  const createVehicle = async () => {
    const license_plate = newVehiclePlate.trim();
    if (!license_plate) return;
    try {
      const res = await fetch('/api/admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_plate,
          model: newVehicleModel || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const created: Vehicle = json.data;
      setVehiclesLocal((prev) => [...prev, created]);
      onVehicleCreated?.(created);
      setVehicleId(created.id);
      setVehicleQuery(
        `${created.license_plate}${created.model ? ` · ${created.model}` : ''}`
      );
      setShowAddVehicle(false);
      setNewVehiclePlate('');
      setNewVehicleModel('');
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'יצירת רכב נכשלה');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      try {
        trackFormSubmitted({
          form: 'TaskDialog',
          mode,
          success: false,
          error_message: v,
        });
      } catch {
        // optional analytics
      }
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const resolveClientId = (id: string, query: string) => {
        if (id) return id;
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return '';
        const match = clientsLocal.find(
          (c) => c.name.toLowerCase() === normalizedQuery
        );
        return match?.id || '';
      };

      // Resolve vehicleId from query if not set but query exists (exact match on license plate)
      let finalVehicleId = vehicleId;
      if (!finalVehicleId && vehicleQuery.trim()) {
        const normalizedQuery = vehicleQuery.trim().toLowerCase();
        const match = vehiclesLocal.find((v) => {
          const plate = v.license_plate.toLowerCase();
          // Check against plate only, or the formatted "plate · model" string
          const formatted = `${v.license_plate}${
            v.model ? ` · ${v.model}` : ''
          }`.toLowerCase();
          return plate === normalizedQuery || formatted === normalizedQuery;
        });
        if (match) {
          finalVehicleId = match.id;
        }
      }

      let finalClientId = clientId;
      let finalAdvisorForTask = advisorName.trim();
      let addressForTask = addressQuery || '';
      let stopsPayload: {
        client_id: string;
        address: string;
        advisor_name: string;
        sort_order: number;
      }[] = [];

      if (isMultiStopType) {
        stopsPayload = stops.map((stop, idx) => {
          const resolvedClientId = resolveClientId(
            stop.clientId,
            stop.clientQuery
          );
          if (!resolvedClientId) {
            throw new Error('חובה לבחור לקוח עבור כל עצירה');
          }
          const addressValue = stop.address.trim();
          if (!addressValue) {
            throw new Error('חובה להזין כתובת עבור כל עצירה');
          }
          const advisorValue = stop.advisorName.trim();
          if (!advisorValue) {
            throw new Error('חובה להזין שם יועץ עבור כל עצירה');
          }

          return {
            client_id: resolvedClientId,
            address: addressValue,
            advisor_name: advisorValue,
            sort_order: idx,
          };
        });

        if (stopsPayload.length > 0) {
          finalClientId = stopsPayload[0].client_id;
          addressForTask = stopsPayload[0].address;
          finalAdvisorForTask = stopsPayload[0].advisor_name;
          setAddressQuery(stopsPayload[0].address);
        }
      } else {
        finalClientId = resolveClientId(clientId, clientQuery);
        finalAdvisorForTask = advisorName.trim();
        addressForTask = addressQuery || '';
      }

      // Validation for "Replacement Car Delivery" - must have client and vehicle
      if (type === 'הסעת רכב חלופי') {
        if (!finalClientId) {
          throw new Error('חובה לבחור לקוח עבור משימת הסעת רכב חלופי');
        }
        if (!finalVehicleId) {
          throw new Error('חובה לבחור רכב עבור משימת הסעת רכב חלופי');
        }
      }

      // Validation for "Drive Client Home"
      if (type === 'הסעת לקוח הביתה') {
        if (!finalClientId) {
          throw new Error('חובה לבחור לקוח עבור משימת הסעת לקוח הביתה');
        }
        if (!finalVehicleId) {
          throw new Error('חובה לבחור רכב עבור משימת הסעת לקוח הביתה');
        }
        if (isMultiStopType) {
          if (stopsPayload.some((s) => !s.advisor_name?.trim())) {
            throw new Error('חובה להזין שם יועץ עבור כל עצירה');
          }
        } else if (!advisorName.trim()) {
          throw new Error('חובה להזין שם יועץ עבור משימת הסעת לקוח הביתה');
        }
      }

      // Validation for "Return Vehicle / Transport" (החזרת רכב/שינוע)
      if (type === 'החזרת רכב/שינוע') {
        if (!finalVehicleId) {
          throw new Error('חובה לבחור רכב עבור משימת החזרת רכב/שינוע');
        }
        if (!finalClientId) {
          throw new Error('חובה לבחור לקוח עבור משימת החזרת רכב/שינוע');
        }
        // Check if client has phone
        const selectedClient = clientsLocal.find((c) => c.id === finalClientId);
        if (!selectedClient?.phone) {
          throw new Error(
            'ללקוח הנבחר אין מספר טלפון (חובה עבור משימת החזרת רכב/שינוע)'
          );
        }
        if (!addressForTask.trim()) {
          throw new Error('חובה להזין כתובת עבור משימת החזרת רכב/שינוע');
        }
      }

      if (mode === 'create') {
        const estimatedStartDatetime = dayjs(estimatedDate)
          .set('hour', parseInt(estimatedStartTime.split(':')[0]))
          .set('minute', parseInt(estimatedStartTime.split(':')[1]))
          .toISOString();
        const estimatedEndDatetime = dayjs(estimatedDate)
          .set('hour', parseInt(estimatedEndTime.split(':')[0]))
          .set('minute', parseInt(estimatedEndTime.split(':')[1]))
          .toISOString();

        const body = {
          title: title.trim() || null,
          type,
          priority,
          status,
          details: details || null,
          advisor_name: finalAdvisorForTask || null,
          estimated_start: estimatedStartDatetime || null,
          estimated_end: estimatedEndDatetime || null,
          address: addressForTask || '',
          client_id: finalClientId || null,
          vehicle_id: finalVehicleId || null,
          lead_driver_id: leadDriverId || null,
          co_driver_ids: coDriverIds,
          stops: stopsPayload.length > 0 ? stopsPayload : undefined,
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
          trackFormSubmitted({
            form: 'TaskDialog',
            mode,
            success: true,
            task_id: created.id,
          });
        } catch {
          // optional
        }
        onOpenChange(false);
      } else {
        if (!task) return;
        const estimatedStartDatetime = dayjs(estimatedDate)
          .set('hour', parseInt(estimatedStartTime.split(':')[0]))
          .set('minute', parseInt(estimatedStartTime.split(':')[1]))
          .toISOString();
        const estimatedEndDatetime = dayjs(estimatedDate)
          .set('hour', parseInt(estimatedEndTime.split(':')[0]))
          .set('minute', parseInt(estimatedEndTime.split(':')[1]))
          .toISOString();

        const update: Partial<Task> & {
          lead_driver_id?: string | null;
          co_driver_ids?: string[];
        } = {
          title: title.trim() || 'משימה ללא כותרת',
          type,
          priority,
          status,
          details: details || null,
          advisor_name: finalAdvisorForTask || null,
          estimated_start: estimatedStartDatetime || undefined,
          estimated_end: estimatedEndDatetime || undefined,
          address: addressForTask || '',
          client_id: finalClientId || null,
          vehicle_id: finalVehicleId || null,
          lead_driver_id: leadDriverId || null,
          co_driver_ids: coDriverIds,
          stops: stopsPayload.length > 0 ? stopsPayload : undefined,
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
        onUpdated?.(updated, leadDriverId || undefined, coDriverIds);
        try {
          trackFormSubmitted({
            form: 'TaskDialog',
            mode,
            success: true,
            task_id: updated.id,
          });
        } catch {
          // optional
        }
        onOpenChange(false);
      }
    } catch (err: unknown) {
      const error = err as Error;
      const errorMessage = error.message || 'שגיאה';
      setError(errorMessage);
      toastError(errorMessage);
      try {
        trackFormSubmitted({
          form: 'TaskDialog',
          mode,
          success: false,
          task_id: task?.id,
          error_message: error.message,
        });
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
      <div
        className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-xl max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">
            {mode === 'create' ? 'יצירת משימה' : 'עריכת משימה'}
          </h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={() => onOpenChange(false)}
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {error && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
          >
          {/* Title field removed per request, but logic kept if needed back. */}
          {/* <label className="flex flex-col gap-1">
            <span className="text-md underline font-medium text-blue-500">
              כותרת
            </span>
            <input
              className="rounded border border-gray-300 p-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label> */}

          <label className="flex flex-col gap-1 ">
            <span className="text-md underline font-medium text-blue-500">
              סוג
            </span>
            <RtlSelectDropdown
              value={type}
              options={types.map((t) => ({ value: t, label: t }))}
              onChange={(value) => setType(value as TaskType)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-md underline font-medium text-blue-500">
              עדיפות
            </span>
            <RtlSelectDropdown
              value={priority}
              options={priorities.map((p) => ({ value: p, label: p }))}
              onChange={(value) => setPriority(value as TaskPriority)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-md underline font-medium text-blue-500">
              סטטוס
            </span>
            <RtlSelectDropdown
              value={status}
              options={statuses.map((s) => ({
                value: s,
                label: statusLabels[s] || s,
              }))}
              onChange={(value) => setStatus(value as TaskStatus)}
            />
          </label>

          <label className="col-span-1 md:col-span-2 flex flex-col gap-1">
            <span className="text-md underline font-medium text-blue-500">
              תיאור
            </span>
            <textarea
              className="rounded border border-gray-300 p-2"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </label>

          {!isMultiStopType && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-primary">
                שם יועץ{' '}
                {type === 'הסעת לקוח הביתה' && (
                  <span className="text-red-500">*</span>
                )}
              </span>
              <input
                className="rounded border border-gray-300 p-2"
                value={advisorName}
                onChange={(e) => setAdvisorName(e.target.value)}
                placeholder="הזן שם יועץ"
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary">תאריך</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-right font-normal ${
                    estimatedDateError ? 'border-red-500' : ''
                  }`}
                >
                  <Calendar className="ml-2 h-4 w-4" />
                  {dayjs(estimatedDate).format('DD/MM/YYYY')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={estimatedDate}
                  className="min-w-56 [--cell-size:2.6rem] bg-white"
                  onSelect={(date) => {
                    if (date) {
                      const result = estimatedDateSchema.safeParse(date);
                      if (result.success) {
                        setEstimatedDate(date);
                        setEstimatedDateError(null);
                      } else {
                        setEstimatedDateError(result.error.issues[0].message);
                      }
                    }
                  }}
                  autoFocus={true}
                  disabled={(date) => {
                    const today = dayjs().startOf('day');
                    const selectedDay = dayjs(date).startOf('day');
                    return selectedDay.isBefore(today);
                  }}
                />
              </PopoverContent>
            </Popover>
            {estimatedDateError && (
              <p className="text-sm text-red-600">{estimatedDateError}</p>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary">שעת התחלה</span>
            <input
              type="time"
              className="rounded border border-gray-300 p-2"
              value={estimatedStartTime}
              onChange={(e) => setEstimatedStartTime(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-primary">שעת סיום</span>
            <input
              type="time"
              className="rounded border border-gray-300 p-2"
              value={estimatedEndTime}
              onChange={(e) => setEstimatedEndTime(e.target.value)}
            />
          </label>

          {!isMultiStopType && (
            <label className="col-span-1 md:col-span-2 flex flex-col gap-1">
              <span className="text-sm font-medium text-primary">כתובת</span>
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
          )}

          {isMultiStopType ? (
            <div className="col-span-1 md:col-span-2 space-y-3 rounded border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-primary">
                    לקוחות / כתובות / יועצים
                  </p>
                  <p className="text-xs text-gray-600">
                    קבע התאמה בין לקוח, כתובת ויועץ לכל עצירה.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-2 text-xs h-9 bg-blue-500 text-white flex items-center justify-center"
                    onClick={() =>
                      setStops((prev) => [
                        ...prev,
                        {
                          clientId: '',
                          clientQuery: '',
                          address: '',
                          advisorName: '',
                        },
                      ])
                    }
                  >
                    <PlusIcon className="w-4 h-4" />
                    הוסף לקוח
                  </button>
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-2 text-xs h-9 bg-white text-primary flex items-center justify-center"
                    onClick={() => setShowAddClient((v) => !v)}
                  >
                    <PlusIcon className="w-4 h-4" />
                    לקוח חדש
                  </button>
                </div>
              </div>

              {stops.map((stop, idx) => {
                const suggestions = getClientSuggestions(stop.clientQuery);
                return (
                  <div
                    key={`stop-${idx}`}
                    className="space-y-3 rounded border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-sm font-semibold text-primary">
                      <span>עצירה {idx + 1}</span>
                      {stops.length > 1 && (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline flex items-center gap-1"
                          onClick={() =>
                            setStops((prev) =>
                              prev.length > 1
                                ? prev.filter((_, i) => i !== idx)
                                : prev
                            )
                          }
                        >
                          <XIcon className="w-4 h-4" />
                          הסר
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="flex flex-col gap-1">
                        <Label className="text-primary">לקוח</Label>
                        <Input
                          type="text"
                          placeholder="שם לקוח"
                          value={stop.clientQuery}
                          onFocus={() => setActiveStopIndex(idx)}
                          onChange={(e) =>
                            setStops((prev) =>
                              prev.map((s, i) =>
                                i === idx
                                  ? {
                                      ...s,
                                      clientQuery: e.target.value,
                                      clientId: '',
                                    }
                                  : s
                              )
                            )
                          }
                        />
                        {suggestions.length > 0 && !stop.clientId && (
                          <div className="mt-1 max-h-40 w-full overflow-y-auto rounded border border-gray-300 bg-white text-sm shadow-sm">
                            {suggestions.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className="flex w-full items-center justify-between px-2 py-1 text-right hover:bg-blue-50"
                                onClick={() =>
                                  setStops((prev) =>
                                    prev.map((s, i) =>
                                      i === idx
                                        ? {
                                            ...s,
                                            clientId: c.id,
                                            clientQuery: c.name,
                                          }
                                        : s
                                    )
                                  )
                                }
                              >
                                <span>{c.name}</span>
                                {c.phone && (
                                  <span className="text-xs text-gray-500">
                                    {c.phone}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-primary">כתובת</Label>
                        <Input
                          type="text"
                          placeholder="כתובת"
                          value={stop.address}
                          onChange={(e) =>
                            setStops((prev) =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, address: e.target.value } : s
                              )
                            )
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-primary">שם יועץ</Label>
                        <Input
                          type="text"
                          placeholder="שם יועץ"
                          value={stop.advisorName}
                          onChange={(e) =>
                            setStops((prev) =>
                              prev.map((s, i) =>
                                i === idx
                                  ? { ...s, advisorName: e.target.value }
                                  : s
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {showAddClient && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <input
                    className="rounded border border-gray-300 p-2 col-span-1"
                    placeholder="שם"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                  />
                  <input
                    className="rounded border border-gray-300 p-2 col-span-1"
                    placeholder="טלפון"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                  />
                  <input
                    className="rounded border border-gray-300 p-2 col-span-1"
                    placeholder="אימייל (אופציונלי)"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                  />
                  <div className="col-span-3 flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded border border-gray-300 px-2 text-xs"
                      onClick={() => setShowAddClient(false)}
                    >
                      בטל
                    </button>
                    <button
                      type="button"
                      className="rounded bg-blue-600 hover:bg-blue-700 px-2 py-1 text-xs font-semibold text-white transition-colors"
                      onClick={createClient}
                    >
                      צור ושייך לעצירה {activeStopIndex + 1}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <label className="flex flex-col gap-1">
              <div className="flex gap-2">
                <div className="grid w-full max-w-sm items-center gap-1">
                  <Label htmlFor="client" className="text-primary">
                    לקוח
                  </Label>
                  <Input
                    type="text"
                    id="client"
                    placeholder="לקוח"
                    value={clientQuery}
                    onChange={(e) => {
                      setClientQuery(e.target.value);
                      setClientId('');
                    }}
                  />
                  {clientSuggestions.length > 0 && !clientId && (
                    <div className="mt-1 max-h-40 w-full overflow-y-auto rounded border border-gray-300 bg-white text-sm shadow-sm">
                      {clientSuggestions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="flex w-full items-center justify-between px-2 py-1 text-right hover:bg-blue-50"
                          onClick={() => {
                            setClientId(c.id);
                            setClientQuery(c.name);
                          }}
                        >
                          <span>{c.name}</span>
                          {c.phone && (
                            <span className="text-xs text-gray-500">
                              {c.phone}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="rounded border border-gray-300 px-2 text-xs h-9 self-end bg-blue-500 text-white flex items-center justify-center"
                  onClick={() => setShowAddClient((v) => !v)}
                >
                  <PlusIcon className="w-4 h-4" />
                  חדש
                </button>
              </div>
              {showAddClient && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <input
                    className="rounded border border-gray-300 p-2 col-span-1"
                    placeholder="שם"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                  />
                  <input
                    className="rounded border border-gray-300 p-2 col-span-1"
                    placeholder="טלפון"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                  />
                  <input
                    className="rounded border border-gray-300 p-2 col-span-1"
                    placeholder="אימייל (אופציונלי)"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                  />

                  <div className="col-span-3 flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded border border-gray-300 px-2 text-xs"
                      onClick={() => setShowAddClient(false)}
                    >
                      בטל
                    </button>
                    <button
                      type="button"
                      className="rounded bg-blue-600 hover:bg-blue-700 px-2 py-1 text-xs font-semibold text-white transition-colors"
                      onClick={createClient}
                    >
                      צור
                    </button>
                  </div>
                </div>
              )}
            </label>
          )}

          <label className="flex flex-col gap-1">
            <div className="flex gap-2">
              <div className="grid w-full max-w-sm items-center gap-1">
                <Label htmlFor="vehicle" className="text-primary">
                  רכב
                </Label>
                <Input
                  type="text"
                  id="vehicle"
                  placeholder="רכב"
                  value={vehicleQuery}
                  onChange={(e) => {
                    setVehicleQuery(e.target.value);
                    setVehicleId(''); // Clear vehicleId when typing to show suggestions
                  }}
                />
                {vehicleSuggestions.length > 0 && !vehicleId && (
                  <div className="mt-1 max-h-40 w-full overflow-y-auto rounded border border-gray-300 bg-white text-sm shadow-sm">
                    {vehicleSuggestions.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="flex w-full items-center justify-between px-2 py-1 text-right hover:bg-blue-50"
                        onClick={() => {
                          setVehicleId(v.id);
                          setVehicleQuery(
                            `${v.license_plate}${
                              v.model ? ` · ${v.model}` : ''
                            }`
                          );
                        }}
                      >
                        <span>
                          {v.license_plate}
                          {v.model ? ` · ${v.model}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="rounded border border-gray-300 px-2 text-xs h-9 self-end bg-blue-500 text-white flex items-center justify-center"
                onClick={() => setShowAddVehicle((v) => !v)}
              >
                <PlusIcon className="w-4 h-4" />
                חדש
              </button>
            </div>
            {showAddVehicle && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <input
                  className="rounded border border-gray-300 p-2 col-span-1"
                  placeholder="מספר רישוי"
                  value={newVehiclePlate}
                  onChange={(e) => setNewVehiclePlate(e.target.value)}
                />
                <input
                  className="rounded border border-gray-300 p-2 col-span-1"
                  placeholder="דגם"
                  value={newVehicleModel}
                  onChange={(e) => setNewVehicleModel(e.target.value)}
                />
                <div className="col-span-3 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-2 text-xs"
                    onClick={() => setShowAddVehicle(false)}
                  >
                    בטל
                  </button>
                  <button
                    type="button"
                    className="rounded bg-blue-600 hover:bg-blue-700 px-2 py-1 text-xs font-semibold text-white transition-colors"
                    onClick={createVehicle}
                  >
                    צור
                  </button>
                </div>
              </div>
            )}
          </label>

          {/* Drivers */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-primary">
                נהג מוביל
              </span>
              <RtlSelectDropdown
                value={leadDriverId}
                options={drivers.map((d) => ({
                  value: d.id,
                  label: d.name || d.email || '',
                }))}
                onChange={(value) => setLeadDriverId(value)}
              />
            </label>

            {multiDriverEnabled && (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-primary">
                  נהגי משנה
                </span>
                <RtlSelectDropdown
                  value={coDriverIds}
                  options={drivers
                    .filter((d) => d.id !== leadDriverId)
                    .map((d) => ({
                      value: d.id,
                      label: d.name || d.email || '',
                    }))}
                  onChange={(val) => setCoDriverIds(val as string[])}
                  multiple
                  placeholder="בחר נהגי משנה"
                />
              </div>
            )}
          </div>

          <div className="col-span-1 md:col-span-2 mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded flex items-center justify-center gap-2 border border-gray-300 px-3 py-2 text-sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              <XIcon className="w-4 h-4 mr-2" />
              ביטול
            </button>
            <button
              type="submit"
              className="rounded flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
              disabled={submitting}
            >
              <SaveIcon className="w-4 h-4 mr-2" />
              {mode === 'create' ? 'צור משימה' : 'שמור שינויים'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
