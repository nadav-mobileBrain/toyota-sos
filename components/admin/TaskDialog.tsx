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
  TaskStop,
  AdvisorColor,
} from '@/types/task';
import {
  getAdvisorColorOptions,
  getAdvisorColorBgClass,
  getAdvisorColorTextClass,
  getAdvisorColorHex,
} from '@/lib/advisorColors';
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
import {
  optimizeRoute,
  geocodeAddress,
  calculateDistance,
  GARAGE_LOCATION,
} from '@/lib/geocoding';
import { AddressAutocomplete } from './AddressAutocomplete';
import {
  formatLicensePlate,
  isValidLicensePlate,
  normalizeLicensePlate,
} from '@/lib/vehicleLicensePlate';

type Mode = 'create' | 'edit';
type StopForm = {
  clientId: string;
  clientQuery: string;
  address: string;
  advisorName: string;
  advisorColor: AdvisorColor | null;
  phone: string;
  lat?: number | null;
  lng?: number | null;
  distanceFromGarage?: number | null;
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
  prefilledDate?: Date | null;
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
  'מסירת רכב חלופי',
  'הסעת לקוח הביתה',
  'הסעת לקוח למוסך',
  'ביצוע טסט',
  'חילוץ רכב תקוע',
  'אחר',
];
const priorities: TaskPriority[] = ['ללא עדיפות', 'מיידי'];
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
    prefilledDate,
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
    task?.priority ?? 'ללא עדיפות'
  );
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'בהמתנה');
  const [details, setDetails] = useState(task?.details ?? '');
  const [estimatedDate, setEstimatedDate] = useState<Date>(
    task?.estimated_start
      ? new Date(task.estimated_start)
      : prefilledDate || new Date()
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
  const [addressQuery, setAddressQuery] = useState(task?.address ?? '');
  const [selectedMainCoords, setSelectedMainCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
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
  const [advisorColor, setAdvisorColor] = useState<AdvisorColor | null>(
    (task?.advisor_color as AdvisorColor) || null
  );
  const [stops, setStops] = useState<StopForm[]>([]);
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const [occupiedVehicleIds, setOccupiedVehicleIds] = useState<Set<string>>(
    new Set()
  );
  const [checkingConflicts, setCheckingConflicts] = useState(false);

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
      setPriority(task?.priority ?? 'ללא עדיפות');
      setStatus(task?.status ?? 'בהמתנה');
      setDetails(task?.details ?? '');
      setAdvisorName(task?.advisor_name ?? '');
      setAdvisorColor((task?.advisor_color as AdvisorColor) || null);
      setEstimatedDate(
        task?.estimated_start
          ? new Date(task.estimated_start)
          : prefilledDate || new Date()
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
      setAddressQuery(task?.address ?? '');
      if (task?.lat && task?.lng) {
        setSelectedMainCoords({ lat: task.lat, lng: task.lng });
      } else {
        setSelectedMainCoords(null);
      }
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
              advisorColor: (task.advisor_color as AdvisorColor) || null,
              phone: existing?.phone || '',
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
              advisorColor: (task?.advisor_color as AdvisorColor) || null,
              phone: '',
            },
          ]);
        }
      }
      setVehicleId(task?.vehicle_id ?? '');
      if (task?.vehicle_id) {
        const existingVehicle = vehicles.find((v) => v.id === task.vehicle_id);
        if (existingVehicle) {
          const plateDisplay = formatLicensePlate(existingVehicle.license_plate);
          const modelDisplay = existingVehicle.model ? ` · ${existingVehicle.model}` : '';
          const unavailableDisplay = existingVehicle.is_available === false ? ' (מושבת)' : '';
          setVehicleQuery(`${plateDisplay}${modelDisplay}${unavailableDisplay}`);
        } else {
          setVehicleQuery('');
        }
      } else {
        setVehicleQuery('');
      }
      // Load driver assignments - check both assignees prop and ensure we have task context
      if (mode === 'edit' && task) {
        // Use assignees prop if available, otherwise empty array
        const taskAssignees =
          assignees.length > 0
            ? assignees.filter((a) => a.task_id === task.id)
            : [];

        if (taskAssignees.length > 0) {
          const lead = taskAssignees.find((a) => a.is_lead);
          const co = taskAssignees
            .filter((a) => !a.is_lead)
            .map((a) => a.driver_id);
          setLeadDriverId(lead?.driver_id ?? '');
          setCoDriverIds(co);
        } else {
          // If no assignees found, reset to empty (might be unassigned task)
          setLeadDriverId('');
          setCoDriverIds([]);
        }
      } else {
        // Create mode - always start empty
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

  // Also update driver assignments when assignees prop changes (for edit mode)
  useEffect(() => {
    if (mode === 'edit' && task && open && assignees.length > 0) {
      const taskAssignees = assignees.filter((a) => a.task_id === task.id);
      if (taskAssignees.length > 0) {
        const lead = taskAssignees.find((a) => a.is_lead);
        const co = taskAssignees
          .filter((a) => !a.is_lead)
          .map((a) => a.driver_id);
        setLeadDriverId(lead?.driver_id ?? '');
        setCoDriverIds(co);
      }
    }
  }, [assignees, task, mode, open]);

  const isMultiStopType = useMemo(() => isMultiStopTaskType(type), [type]);

  // Check for vehicle conflicts when date/time/vehicle changes
  useEffect(() => {
    let cancelled = false;
    const checkVehicleConflicts = async () => {
      // Only check if we have a date and times set
      if (!estimatedDate || !estimatedStartTime || !estimatedEndTime) {
        setOccupiedVehicleIds(new Set());
        return;
      }

      // Build datetime strings
      const startDatetime = dayjs(estimatedDate)
        .set('hour', parseInt(estimatedStartTime.split(':')[0]))
        .set('minute', parseInt(estimatedStartTime.split(':')[1]))
        .toISOString();
      const endDatetime = dayjs(estimatedDate)
        .set('hour', parseInt(estimatedEndTime.split(':')[0]))
        .set('minute', parseInt(estimatedEndTime.split(':')[1]))
        .toISOString();

      setCheckingConflicts(true);
      try {
        // Check all vehicles for conflicts
        const conflictChecks = await Promise.all(
          vehiclesLocal.map(async (vehicle) => {
            try {
              const params = new URLSearchParams({
                vehicle_id: vehicle.id,
                estimated_start: startDatetime,
                estimated_end: endDatetime,
                ...(mode === 'edit' && task?.id
                  ? { task_id: task.id }
                  : {}),
              });
              const res = await fetch(
                `/api/admin/tasks/check-vehicle-conflict?${params}`
              );
              if (!res.ok) return { vehicleId: vehicle.id, hasConflict: false };
              const json = await res.json();
              return {
                vehicleId: vehicle.id,
                hasConflict: json.hasConflict || false,
              };
            } catch {
              return { vehicleId: vehicle.id, hasConflict: false };
            }
          })
        );

        if (!cancelled) {
          const occupied = new Set<string>();
          conflictChecks.forEach((check) => {
            if (check.hasConflict) {
              occupied.add(check.vehicleId);
            }
          });
          setOccupiedVehicleIds(occupied);
        }
      } catch (err) {
        console.error('Failed to check vehicle conflicts', err);
        if (!cancelled) {
          setOccupiedVehicleIds(new Set());
        }
      } finally {
        if (!cancelled) {
          setCheckingConflicts(false);
        }
      }
    };

    // Debounce the check
    const timeoutId = setTimeout(checkVehicleConflicts, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [
    estimatedDate,
    estimatedStartTime,
    estimatedEndTime,
    vehiclesLocal,
    mode,
    task?.id,
  ]);

  useEffect(() => {
    if (isMultiStopType) {
      if (stops.length === 0) {
        const selectedClient = clientsLocal.find((c) => c.id === clientId);
        setStops([
          {
            clientId: clientId || '',
            clientQuery: clientQuery || '',
            address: addressQuery || '',
            advisorName: advisorName || '',
            advisorColor: advisorColor,
            phone: selectedClient?.phone || '',
          },
        ]);
      }
    } else if (stops.length > 0) {
      const first = stops[0];
      setClientId(first.clientId);
      setClientQuery(first.clientQuery);
      setAddressQuery(first.address);
      setAdvisorName(first.advisorName);
      setAdvisorColor(first.advisorColor);
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
            (a: Partial<TaskStop>, b: Partial<TaskStop>) =>
              (a.sort_order ?? 0) - (b.sort_order ?? 0)
          )
          .map((s: Partial<TaskStop>) => {
            const client = clientsLocal.find((c) => c.id === s?.client_id);
            const clientName = client?.name || '';
            // Use phone from stop if exists, otherwise fallback to client's phone
            const phone = s?.phone || client?.phone || '';
            return {
              clientId: s?.client_id || '',
              clientQuery: clientName,
              address: s?.address || '',
              advisorName: s?.advisor_name || '',
              advisorColor: (s?.advisor_color as AdvisorColor) || null,
              phone,
              lat: s?.lat || null,
              lng: s?.lng || null,
              distanceFromGarage: s?.distance_from_garage || null,
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
    // Normalize search query (remove dashes/spaces) to match normalized plates in DB
    const normalizedQuery = q.replace(/\D/g, '');
    return vehiclesLocal
      .filter((v) => {
        const plate = v.license_plate?.toLowerCase() ?? '';
        const normalizedPlate = plate.replace(/\D/g, ''); // Normalize plate for comparison
        const model = v.model?.toLowerCase() ?? '';
        // Search in both formatted and normalized plate, and in model
        return (
          plate.includes(q) ||
          normalizedPlate.includes(normalizedQuery) ||
          model.includes(q)
        );
      })
      .slice(0, 8)
      .map((v) => ({
        ...v,
        isOccupied: occupiedVehicleIds.has(v.id),
        isUnavailable: v.is_available === false,
      }));
  }, [vehiclesLocal, vehicleQuery, occupiedVehicleIds]);

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
        toastError('חובה להוסיף לפחות לקוח אחד עבור סוג משימה זה');
        return 'חובה להוסיף לפחות לקוח אחד עבור סוג משימה זה';
      }
      for (const stop of stops) {
        if (!(stop.clientId || stop.clientQuery.trim())) {
          toastError('חובה לבחור לקוח עבור כל עצירה');
          return 'חובה לבחור לקוח עבור כל עצירה';
        }
        if (!stop.phone?.trim()) {
          toastError('חובה להזין טלפון עבור כל עצירה');
          return 'חובה להזין טלפון עבור כל עצירה';
        }
        if (!stop.address.trim()) {
          toastError('חובה להזין כתובת עבור כל עצירה');
          return 'חובה להזין כתובת עבור כל עצירה';
        }
        if (!stop.advisorName.trim() && !stop.advisorColor) {
          toastError('חובה להזין שם יועץ או לבחור צבע יועץ עבור כל עצירה');
          return 'חובה להזין שם יועץ או לבחור צבע יועץ עבור כל עצירה';
        }
      }
    }

    return null;
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
                advisorColor: null,
                phone: created.phone || '',
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
                  phone: created.phone || stop.phone || '',
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
    if (!license_plate) {
      setError('חובה להזין מספר רישוי');
      return;
    }

    // Validate license plate format
    const digitsOnly = license_plate.replace(/\D/g, '');
    const digitCount = digitsOnly.length;

    if (digitCount < 7) {
      setError(
        `מספר רישוי חייב להכיל לפחות 7 ספרות (נמצאו ${digitCount} ספרות)`
      );
      return;
    }

    if (digitCount > 8) {
      setError(
        `מספר רישוי חייב להכיל לכל היותר 8 ספרות (נמצאו ${digitCount} ספרות)`
      );
      return;
    }

    if (!isValidLicensePlate(license_plate)) {
      setError('מספר רישוי חייב להכיל בדיוק 7 או 8 ספרות');
      return;
    }

    // Normalize license plate (remove dashes/spaces) before sending to API
    const normalizedPlate = normalizeLicensePlate(license_plate);

    try {
      const res = await fetch('/api/admin/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_plate: normalizedPlate,
          model: newVehicleModel || null,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorText;
        } catch {
          // If not JSON, use the text as is
        }
        
        // Check for duplicate key error
        if (
          errorMessage.includes('duplicate key value violates unique constraint') ||
          errorMessage.includes('vehicles_license_plate_key')
        ) {
          toastError('מספר רישוי זה כבר קיים במערכת');
          setError('מספר רישוי זה כבר קיים במערכת');
          return;
        }
        
        throw new Error(errorMessage);
      }
      const json = await res.json();
      const created: Vehicle = json.data;
      setVehiclesLocal((prev) => [...prev, created]);
      onVehicleCreated?.(created);
      setVehicleId(created.id);
      setVehicleQuery(
        `${formatLicensePlate(created.license_plate)}${
          created.model ? ` · ${created.model}` : ''
        }`
      );
      setShowAddVehicle(false);
      setNewVehiclePlate('');
      setNewVehicleModel('');
    } catch (err: unknown) {
      const error = err as Error;
      const errorMessage = error.message || 'יצירת רכב נכשלה';
      setError(errorMessage);
      // Only show toast if not already shown (duplicate key case)
      if (
        !errorMessage.includes('מספר רישוי זה כבר קיים במערכת')
      ) {
        toastError(errorMessage);
      }
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
        // Normalize query (remove dashes/spaces) for comparison
        const normalizedQueryDigits = normalizedQuery.replace(/\D/g, '');
        const match = vehiclesLocal.find((v) => {
          const plate = v.license_plate.toLowerCase();
          const normalizedPlate = plate.replace(/\D/g, ''); // Normalize plate
          // Check against plate (formatted or normalized), or the formatted "plate · model" string
          const formatted = `${formatLicensePlate(v.license_plate)}${
            v.model ? ` · ${v.model}` : ''
          }`.toLowerCase();
          return (
            plate === normalizedQuery ||
            normalizedPlate === normalizedQueryDigits ||
            formatted === normalizedQuery
          );
        });
        if (match) {
          finalVehicleId = match.id;
        }
      }

      // Validate vehicle conflict before submission
      if (finalVehicleId && occupiedVehicleIds.has(finalVehicleId)) {
        throw new Error(
          'רכב זה כבר משוייך למשימה אחרת באותו יום ובאותו טווח זמן'
        );
      }

      let finalClientId = clientId;
      let finalAdvisorForTask = advisorName.trim();
      let finalAdvisorColor = advisorColor;
      let addressForTask = addressQuery || '';
      let finalDistanceFromGarage: number | null = null;
      let finalLat: number | null = null;
      let finalLng: number | null = null;
      let stopsPayload: {
        client_id: string;
        address: string;
        advisor_name: string | null;
        advisor_color: AdvisorColor | null;
        phone: string;
        sort_order: number;
        lat: number | null;
        lng: number | null;
        distance_from_garage: number | null;
      }[] = [];

      let stopsToProcess: StopForm[] = stops;

      if (isMultiStopType) {
        if (stops.length > 1) {
          toastSuccess('מבצע אופטימיזציה למסלול...');
          try {
            const result = await optimizeRoute(stops, (s) => s.address);
            stopsToProcess = result.map(({ item, geocode }) => ({
              ...item,
              lat: geocode?.coords.lat ?? item.lat,
              lng: geocode?.coords.lng ?? item.lng,
              distanceFromGarage: geocode?.distance ?? item.distanceFromGarage,
            }));
            toastSuccess('המסלול עבר אופטימיזציה בהצלחה');
          } catch (err) {
            console.error('Optimization failed', err);
          }
        }

        stopsPayload = stopsToProcess.map((stop, idx) => {
          const resolvedClientId = resolveClientId(
            stop.clientId,
            stop.clientQuery
          );
          if (!resolvedClientId) {
            throw new Error('חובה לבחור לקוח עבור כל עצירה');
          }
          const phoneValue = stop.phone?.trim() || '';
          if (!phoneValue) {
            throw new Error('חובה להזין טלפון עבור כל עצירה');
          }
          const addressValue = stop.address.trim();
          if (!addressValue) {
            throw new Error('חובה להזין כתובת עבור כל עצירה');
          }
          const advisorValue = stop.advisorName.trim();
          const advisorColorValue = stop.advisorColor;
          if (!advisorValue && !advisorColorValue) {
            throw new Error(
              'חובה להזין שם יועץ או לבחור צבע יועץ עבור כל עצירה'
            );
          }

          return {
            client_id: resolvedClientId,
            address: addressValue,
            advisor_name: advisorValue || null,
            advisor_color: advisorColorValue || null,
            phone: phoneValue,
            sort_order: idx,
            lat: stop.lat || null,
            lng: stop.lng || null,
            distance_from_garage: stop.distanceFromGarage || null,
          };
        });

        if (stopsPayload.length > 0) {
          finalClientId = stopsPayload[0].client_id;
          addressForTask = stopsPayload[0].address;
          finalAdvisorForTask = stopsPayload[0].advisor_name || '';
          finalAdvisorColor = stopsPayload[0].advisor_color;
          finalDistanceFromGarage = stopsPayload[0].distance_from_garage;
          finalLat = stopsPayload[0].lat;
          finalLng = stopsPayload[0].lng;
          setAddressQuery(stopsPayload[0].address);
          if (finalLat && finalLng) {
            setSelectedMainCoords({ lat: finalLat, lng: finalLng });
          }
        }
      } else {
        finalClientId = resolveClientId(clientId, clientQuery);
        finalAdvisorForTask = advisorName.trim();
        addressForTask = addressQuery || '';

        if (selectedMainCoords) {
          finalLat = selectedMainCoords.lat;
          finalLng = selectedMainCoords.lng;
          finalDistanceFromGarage = calculateDistance(
            GARAGE_LOCATION,
            selectedMainCoords
          );
        } else if (addressForTask) {
          try {
            const coords = await geocodeAddress(addressForTask);
            if (coords) {
              finalLat = coords.lat;
              finalLng = coords.lng;
              finalDistanceFromGarage = calculateDistance(
                GARAGE_LOCATION,
                coords
              );
            }
          } catch (err) {
            console.error('Geocoding main address failed', err);
          }
        }
      }

      // Validation for "Replacement Car Delivery" - must have client and vehicle
      if (type === 'מסירת רכב חלופי') {
        if (!finalClientId) {
          throw new Error('חובה לבחור לקוח עבור משימת מסירת רכב חלופי');
        }
        if (!finalVehicleId) {
          throw new Error('חובה לבחור רכב עבור משימת מסירת רכב חלופי');
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
          if (
            stopsPayload.some(
              (s) => !s.advisor_name?.trim() && !s.advisor_color
            )
          ) {
            throw new Error(
              'חובה להזין שם יועץ או לבחור צבע יועץ עבור כל עצירה'
            );
          }
        } else if (!advisorName.trim() && !advisorColor) {
          throw new Error(
            'חובה להזין שם יועץ או לבחור צבע יועץ עבור משימת הסעת לקוח הביתה'
          );
        }
      }

      // Validation for "Pickup Vehicle / Transport" (איסוף רכב/שינוע)
      if (type === 'איסוף רכב/שינוע') {
        if (!finalVehicleId) {
          throw new Error('חובה לבחור רכב עבור משימת איסוף רכב/שינוע');
        }
        if (!finalClientId) {
          throw new Error('חובה לבחור לקוח עבור משימת איסוף רכב/שינוע');
        }
        if (!addressForTask.trim()) {
          throw new Error('חובה להזין כתובת עבור משימת איסוף רכב/שינוע');
        }
        if (!finalAdvisorForTask.trim() && !finalAdvisorColor) {
          throw new Error(
            'חובה להזין שם יועץ או לבחור צבע יועץ עבור משימת איסוף רכב/שינוע'
          );
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

      // Validation for "Test Execution" (ביצוע טסט) - must have client and vehicle
      if (type === 'ביצוע טסט') {
        if (!finalClientId) {
          throw new Error('חובה לבחור לקוח עבור משימת ביצוע טסט');
        }
        if (!finalVehicleId) {
          throw new Error('חובה לבחור רכב עבור משימת ביצוע טסט');
        }
      }

      // Validation for "Vehicle Rescue" (חילוץ רכב תקוע) - must have client, vehicle, and address
      if (type === 'חילוץ רכב תקוע') {
        if (!finalClientId) {
          throw new Error('חובה לבחור לקוח עבור משימת חילוץ רכב תקוע');
        }
        if (!finalVehicleId) {
          throw new Error('חובה לבחור רכב עבור משימת חילוץ רכב תקוע');
        }
        if (!addressForTask.trim()) {
          throw new Error('חובה להזין כתובת עבור משימת חילוץ רכב תקוע');
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
          advisor_color: advisorColor || null,
          estimated_start: estimatedStartDatetime || null,
          estimated_end: estimatedEndDatetime || null,
          address: addressForTask || '',
          client_id: finalClientId || null,
          vehicle_id: finalVehicleId || null,
          distance_from_garage: finalDistanceFromGarage || null,
          lat: finalLat,
          lng: finalLng,
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

        const update: Omit<Partial<Task>, 'stops'> & {
          lead_driver_id?: string | null;
          co_driver_ids?: string[];
          lat?: number | null;
          lng?: number | null;
          stops?: {
            client_id: string;
            address: string;
            advisor_name: string | null;
            advisor_color: AdvisorColor | null;
            phone: string;
            sort_order: number;
            lat: number | null;
            lng: number | null;
            distance_from_garage: number | null;
          }[];
        } = {
          title: title.trim() || 'משימה ללא כותרת',
          type,
          priority,
          status,
          details: details || null,
          advisor_name: finalAdvisorForTask || null,
          advisor_color: finalAdvisorColor || null,
          estimated_start: estimatedStartDatetime || undefined,
          estimated_end: estimatedEndDatetime || undefined,
          address: addressForTask || '',
          client_id: finalClientId || null,
          vehicle_id: finalVehicleId || null,
          distance_from_garage: finalDistanceFromGarage || null,
          lat: finalLat,
          lng: finalLng,
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
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </label>

            {!isMultiStopType && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-primary">
                    שם יועץ{' '}
                    {(type === 'הסעת לקוח הביתה' ||
                      type === 'איסוף רכב/שינוע') && (
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
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-primary">
                    צבע יועץ{' '}
                    {(type === 'הסעת לקוח הביתה' ||
                      type === 'איסוף רכב/שינוע') && (
                      <span className="text-red-500">*</span>
                    )}
                  </span>
                  <RtlSelectDropdown
                    value={advisorColor || ''}
                    options={[
                      { value: '', label: '—' },
                      ...getAdvisorColorOptions().map((color) => ({
                        value: color,
                        label: color,
                        bgClass: getAdvisorColorBgClass(color),
                        textClass: getAdvisorColorTextClass(color),
                        color: getAdvisorColorHex(color),
                      })),
                    ]}
                    onChange={(value) =>
                      setAdvisorColor(
                        value === '' ? null : (value as AdvisorColor)
                      )
                    }
                    placeholder="בחר צבע"
                  />
                  {advisorColor && (
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getAdvisorColorBgClass(
                          advisorColor
                        )} ${getAdvisorColorTextClass(advisorColor)}`}
                      >
                        {advisorColor}
                      </span>
                    </div>
                  )}
                </label>
              </>
            )}

            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
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
                            setEstimatedDateError(
                              result.error.issues[0].message
                            );
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
                <span className="text-sm font-medium text-primary">
                  שעת התחלה
                </span>
                <input
                  type="time"
                  className="rounded border border-gray-300 p-2"
                  value={estimatedStartTime}
                  onChange={(e) => setEstimatedStartTime(e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-primary">
                  שעת סיום
                </span>
                <input
                  type="time"
                  className="rounded border border-gray-300 p-2"
                  value={estimatedEndTime}
                  onChange={(e) => setEstimatedEndTime(e.target.value)}
                />
              </label>
            </div>

            {!isMultiStopType && (
              <label className="col-span-1 md:col-span-2 flex flex-col gap-1">
                <span className="text-sm font-medium text-primary">
                  כתובת
                  {(type === 'חילוץ רכב תקוע' ||
                    type === 'איסוף רכב/שינוע' ||
                    type === 'החזרת רכב/שינוע') && (
                    <span className="text-red-500"> *</span>
                  )}
                </span>
                <AddressAutocomplete
                  value={addressQuery}
                  onChange={(val) => {
                    setAddressQuery(val);
                    setSelectedMainCoords(null);
                  }}
                  onSelect={(addr, lat, lng) => {
                    setAddressQuery(addr);
                    setSelectedMainCoords({ lat, lng });
                  }}
                  className="w-full"
                />
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
                            advisorColor: null,
                            phone: '',
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
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div className="flex flex-col gap-1">
                            <Label className="text-primary">
                              לקוח
                              {(type === 'הסעת לקוח הביתה' ||
                                type === 'הסעת לקוח למוסך') && (
                                <span className="text-red-500"> *</span>
                              )}
                            </Label>
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
                                                phone: c.phone || '',
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
                            <Label className="text-primary">
                              טלפון
                              {(type === 'הסעת לקוח הביתה' ||
                                type === 'הסעת לקוח למוסך') && (
                                <span className="text-red-500"> *</span>
                              )}
                            </Label>
                            <Input
                              type="tel"
                              placeholder="טלפון"
                              value={stop.phone}
                              onChange={(e) =>
                                setStops((prev) =>
                                  prev.map((s, i) =>
                                    i === idx ? { ...s, phone: e.target.value } : s
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-primary">
                              כתובת
                              {(type === 'הסעת לקוח הביתה' ||
                                type === 'הסעת לקוח למוסך') && (
                                <span className="text-red-500"> *</span>
                              )}
                            </Label>
                            <AddressAutocomplete
                              value={stop.address}
                              onChange={(val) =>
                                setStops((prev) =>
                                  prev.map((s, i) =>
                                    i === idx
                                      ? {
                                          ...s,
                                          address: val,
                                          lat: null,
                                          lng: null,
                                          distanceFromGarage: null,
                                        }
                                      : s
                                  )
                                )
                              }
                              onSelect={(addr, lat, lng) =>
                                setStops((prev) =>
                                  prev.map((s, i) =>
                                    i === idx
                                      ? {
                                          ...s,
                                          address: addr,
                                          lat,
                                          lng,
                                          distanceFromGarage: calculateDistance(
                                            GARAGE_LOCATION,
                                            { lat, lng }
                                          ),
                                        }
                                      : s
                                  )
                                )
                              }
                              placeholder="כתובת"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div className="flex flex-col gap-1">
                            <Label className="text-primary">
                              שם יועץ <span className="text-red-500">*</span>
                            </Label>
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
                          <div className="flex flex-col gap-1">
                            <Label className="text-primary">
                              צבע יועץ <span className="text-red-500">*</span>
                            </Label>
                            <RtlSelectDropdown
                              value={stop.advisorColor || ''}
                              options={[
                                { value: '', label: '—' },
                                ...getAdvisorColorOptions().map((color) => ({
                                  value: color,
                                  label: color,
                                  bgClass: getAdvisorColorBgClass(color),
                                  textClass: getAdvisorColorTextClass(color),
                                  color: getAdvisorColorHex(color),
                                })),
                              ]}
                              onChange={(value) =>
                                setStops((prev) =>
                                  prev.map((s, i) =>
                                    i === idx
                                      ? {
                                          ...s,
                                          advisorColor:
                                            value === ''
                                              ? null
                                              : (value as AdvisorColor),
                                        }
                                      : s
                                  )
                                )
                              }
                              placeholder="בחר צבע"
                            />
                            {stop.advisorColor && (
                              <div className="mt-1 flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getAdvisorColorBgClass(
                                    stop.advisorColor
                                  )} ${getAdvisorColorTextClass(
                                    stop.advisorColor
                                  )}`}
                                >
                                  {stop.advisorColor}
                                </span>
                              </div>
                            )}
                          </div>
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
                      {(type === 'ביצוע טסט' ||
                        type === 'חילוץ רכב תקוע' ||
                        type === 'מסירת רכב חלופי' ||
                        type === 'הסעת לקוח הביתה' ||
                        type === 'איסוף רכב/שינוע' ||
                        type === 'החזרת רכב/שינוע') && (
                        <span className="text-red-500"> *</span>
                      )}
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
                    {(type === 'ביצוע טסט' ||
                      type === 'חילוץ רכב תקוע' ||
                      type === 'מסירת רכב חלופי' ||
                      type === 'הסעת לקוח הביתה' ||
                      type === 'איסוף רכב/שינוע' ||
                      type === 'החזרת רכב/שינוע') && (
                      <span className="text-red-500"> *</span>
                    )}
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
                      {vehicleSuggestions.map((v) => {
                        // Don't mark as occupied if it's the currently selected vehicle
                        const isOccupied =
                          (v.isOccupied || false) && v.id !== vehicleId;
                        const isUnavailable = v.isUnavailable || false;
                        const isDisabled = isOccupied || isUnavailable;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            disabled={isDisabled}
                            className={`flex w-full items-center justify-between px-2 py-1 text-right ${
                              isDisabled
                                ? 'cursor-not-allowed bg-gray-100 text-gray-400 opacity-60'
                                : 'hover:bg-blue-50'
                            }`}
                            onClick={() => {
                              if (isOccupied) {
                                toastError(
                                  'רכב זה כבר משוייך למשימה אחרת באותו יום ובאותו טווח זמן'
                                );
                                return;
                              }
                              if (isUnavailable) {
                                toastError('רכב זה מושבת ולא זמין לשימוש');
                                return;
                              }
                              setVehicleId(v.id);
                              setVehicleQuery(
                                `${formatLicensePlate(v.license_plate)}${
                                  v.model ? ` · ${v.model}` : ''
                                }`
                              );
                            }}
                          >
                            <span
                              className={isDisabled ? 'text-gray-400' : ''}
                            >
                              {formatLicensePlate(v.license_plate)}
                              {v.model ? ` · ${v.model}` : ''}
                              {isOccupied && (
                                <span className="mr-2 text-xs">
                                  (תפוס)
                                </span>
                              )}
                              {isUnavailable && (
                                <span className="mr-2 text-xs">
                                  (מושבת)
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
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
                  <div className="col-span-1 flex flex-col gap-1">
                    <label className="text-sm font-medium text-primary">
                      מספר רישוי <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="rounded border border-gray-300 p-2"
                      placeholder="מספר רישוי (7 או 8 ספרות)"
                      value={newVehiclePlate}
                      onChange={(e) => {
                        const input = e.target.value;
                        // Allow digits and dashes only
                        const cleaned = input.replace(/[^\d-]/g, '');
                        // Format as user types
                        const formatted = formatLicensePlate(cleaned);
                        setNewVehiclePlate(formatted);
                        // Clear error when user starts typing
                        if (error && error.includes('מספר רישוי')) {
                          setError(null);
                        }
                      }}
                      maxLength={10} // Max length for formatted plate (e.g., "123-45-678")
                    />
                    {newVehiclePlate &&
                      (() => {
                        const digitsOnly = newVehiclePlate.replace(/\D/g, '');
                        const digitCount = digitsOnly.length;
                        if (digitCount === 0) return null;
                        if (digitCount < 7) {
                          return (
                            <p className="text-xs text-red-600">
                              מספר רישוי חייב להכיל לפחות 7 ספרות (נמצאו{' '}
                              {digitCount} ספרות)
                            </p>
                          );
                        }
                        if (digitCount > 8) {
                          return (
                            <p className="text-xs text-red-600">
                              מספר רישוי חייב להכיל לכל היותר 8 ספרות (נמצאו{' '}
                              {digitCount} ספרות)
                            </p>
                          );
                        }
                        return null;
                      })()}
                  </div>
                  <div className="col-span-1 flex flex-col gap-1">
                    <label className="text-sm font-medium text-primary">
                      דגם
                    </label>
                    <input
                      className="rounded border border-gray-300 p-2"
                      placeholder="דגם"
                      value={newVehicleModel}
                      onChange={(e) => setNewVehicleModel(e.target.value)}
                    />
                  </div>
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
