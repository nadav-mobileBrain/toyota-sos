'use client';

import dayjs from '@/lib/dayjs';
import React, { useMemo } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { MapPinIcon, PhoneIcon, Navigation } from 'lucide-react';
import { TaskAttachments } from '@/components/admin/TaskAttachments';
import {
  getAdvisorColorBgClass,
  getAdvisorColorTextClass,
} from '@/lib/advisorColors';
import { formatDistance } from '@/lib/geocoding';
import type { AdvisorColor } from '@/types/task';
import { formatLicensePlate } from '@/lib/vehicleLicensePlate';

export type TaskCardProps = {
  id: string;
  title: string;
  type: string;
  priority: 'ללא עדיפות' | 'מיידי' | 'נמוכה' | 'בינונית' | 'גבוהה';
  status: 'בהמתנה' | 'בעבודה' | 'חסומה' | 'הושלמה';
  estimatedStart?: string | Date | null;
  estimatedEnd?: string | Date | null;
  address?: string | null;
  distanceFromGarage?: number | null;
  clientName?: string | null;
  clientPhone?: string | null;
  advisorName?: string | null;
  advisorColor?: AdvisorColor | null;
  stops?: {
    address: string;
    distanceFromGarage?: number | null;
    clientName?: string | null;
    clientPhone?: string | null;
    advisorName?: string | null;
    advisorColor?: AdvisorColor | null;
  }[];
  vehicle?: { licensePlate?: string | null; model?: string | null } | null;
  details?: string | null;
  onStatusChange?: (next: TaskCardProps['status']) => void;
};

export function TaskCard(props: TaskCardProps) {
  const {
    id,
    type,
    priority,
    status,
    estimatedStart,
    estimatedEnd,
    address,
    distanceFromGarage,
    clientName,
    clientPhone,
    advisorName,
    advisorColor,
    stops,
    vehicle,
    details,
    onStatusChange,
  } = props;

  const sortedStops = useMemo(() => {
    if (!stops || stops.length === 0) return [];
    return [...stops].sort((a, b) => {
      const distA = a.distanceFromGarage ?? Infinity;
      const distB = b.distanceFromGarage ?? Infinity;
      return distA - distB;
    });
  }, [stops]);

  const priorityColor =
    priority === 'מיידי'
      ? 'bg-red-600'
      : priority === 'גבוהה'
      ? 'bg-red-600'
      : priority === 'בינונית'
      ? 'bg-yellow-500'
      : priority === 'נמוכה'
      ? 'bg-green-600'
      : 'bg-gray-400';

  const statusTheme: Record<
    TaskCardProps['status'],
    { pill: string; dot: string; on: string }
  > = {
    בהמתנה: {
      pill: 'bg-gray-100 text-gray-800',
      dot: 'bg-gray-500',
      on: 'data-[state=on]:bg-gray-700 data-[state=on]:border-gray-700',
    },
    בעבודה: {
      pill: 'bg-blue-50 text-blue-800',
      dot: 'bg-blue-500',
      on: 'data-[state=on]:bg-blue-600 data-[state=on]:border-blue-600',
    },
    חסומה: {
      pill: 'bg-amber-50 text-amber-800',
      dot: 'bg-amber-500',
      on: 'data-[state=on]:bg-amber-500 data-[state=on]:border-amber-500',
    },
    הושלמה: {
      pill: 'bg-emerald-50 text-emerald-800',
      dot: 'bg-emerald-500',
      on: 'data-[state=on]:bg-emerald-600 data-[state=on]:border-emerald-600',
    },
  };

  const timeWindow =
    estimatedStart && estimatedEnd
      ? `${dayjs(estimatedStart).format('HH:mm')} – ${dayjs(
          estimatedEnd
        ).format('HH:mm')}`
      : estimatedEnd
      ? `עד ${dayjs(estimatedEnd).format('HH:mm')}`
      : 'ללא זמן יעד';

  const primaryAddress =
    sortedStops.length > 0 ? sortedStops[0].address : address || undefined;

  const wazeHref = primaryAddress
    ? `waze://?navigate=yes&q=${encodeURIComponent(primaryAddress)}`
    : undefined;

  const googleMapsHref = useMemo(() => {
    if (sortedStops.length <= 1) {
      return primaryAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            primaryAddress
          )}`
        : undefined;
    }

    const destination = encodeURIComponent(
      sortedStops[sortedStops.length - 1].address
    );
    const waypoints = sortedStops
      .slice(0, -1)
      .map((s) => encodeURIComponent(s.address))
      .join('|');

    return `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
  }, [sortedStops, primaryAddress]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {priority !== 'ללא עדיפות' && (
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500">עדיפות</span>
              <span
                className={cn(
                  'inline-flex rounded px-2 py-1 text-xs text-white',
                  priorityColor
                )}
              >
                {priority}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-center text-xs text-gray-500 sm:text-right">
            סטטוס
          </span>
          <ToggleGroup
            type="single"
            value={status}
            onValueChange={(value) => {
              if (!value || value === status) return;
              onStatusChange?.(value as TaskCardProps['status']);
            }}
            aria-label="עדכון סטטוס משימה"
            className="w-full justify-between"
          >
            {(
              [
                'בהמתנה',
                'בעבודה',
                'הושלמה',
                'חסומה',
              ] as TaskCardProps['status'][]
            ).map((value) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className={cn(
                  'flex-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700 sm:text-xs',
                  statusTheme[value].on
                )}
              >
                {value}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <p className="text-md py-2 text-black font-bold">{type}</p>

      <div className="mt-3 space-y-2 text-sm text-gray-700">
        <div>חלון זמן: {timeWindow}</div>
        {sortedStops && sortedStops.length > 0 ? (
          <div className="space-y-1 rounded border border-gray-200 bg-gray-50 p-2">
            {sortedStops.map((s, idx) => {
              return (
                <div key={`${s.address}-${idx}`} className="space-y-0.5">
                  <div className="text-xs font-semibold text-gray-600">
                    עצירה {idx + 1}
                  </div>
                  {s.address ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">כתובת: {s.address}</div>
                      {s.distanceFromGarage !== null &&
                        s.distanceFromGarage !== undefined && (
                          <span
                            className="shrink-0 text-[10px] text-gray-400 font-medium"
                            dir="ltr"
                          >
                            ({formatDistance(s.distanceFromGarage)})
                          </span>
                        )}
                    </div>
                  ) : null}
                  {s.clientName ? (
                    <div className="flex items-center gap-2">
                      <span>לקוח: {s.clientName}</span>
                      {s.clientPhone && (
                        <a
                          href={`tel:${s.clientPhone}`}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <PhoneIcon className="w-3 h-3" />
                          <span className="text-xs" dir="ltr">
                            {s.clientPhone}
                          </span>
                        </a>
                      )}
                    </div>
                  ) : null}

                  {(s.advisorName || s.advisorColor) && (
                    <div className="flex items-center gap-2">
                      <span>יועץ:</span>
                      {s.advisorName && <span>{s.advisorName}</span>}
                      {s.advisorColor && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getAdvisorColorBgClass(
                            s.advisorColor
                          )} ${getAdvisorColorTextClass(s.advisorColor)}`}
                        >
                          {s.advisorColor}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {address ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">כתובת: {address}</div>
                {distanceFromGarage !== null &&
                  distanceFromGarage !== undefined && (
                    <span
                      className="shrink-0 text-[10px] text-gray-400 font-medium"
                      dir="ltr"
                    >
                      ({formatDistance(distanceFromGarage)})
                    </span>
                  )}
              </div>
            ) : null}
            {clientName ? (
              <div className="flex items-center gap-2">
                <span>לקוח: {clientName}</span>
                {clientPhone && (
                  <a
                    href={`tel:${clientPhone}`}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <PhoneIcon className="w-3 h-3" />
                    <span className="text-xs" dir="ltr">
                      {clientPhone}
                    </span>
                  </a>
                )}
              </div>
            ) : null}
            {(advisorName || advisorColor) && (
              <div className="flex items-center gap-2">
                <span>יועץ:</span>
                {advisorName && <span>{advisorName}</span>}
                {advisorColor && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getAdvisorColorBgClass(
                      advisorColor
                    )} ${getAdvisorColorTextClass(advisorColor)}`}
                  >
                    {advisorColor}
                  </span>
                )}
              </div>
            )}
          </>
        )}
        {vehicle?.licensePlate ? (
          <div>
            רכב: {formatLicensePlate(vehicle.licensePlate)}
            {vehicle.model ? ` • ${vehicle.model}` : ''}
          </div>
        ) : null}
        {type === 'אחר' && details && details.trim() ? (
          <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs font-semibold text-gray-600 mb-1">
              תיאור המשימה:
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {details}
            </div>
          </div>
        ) : null}
      </div>

      {/* Task Attachments (images and signatures) */}
      <TaskAttachments taskId={id} taskType={type} />

      <div className="mt-3 flex flex-wrap gap-2">
        {wazeHref ? (
          <a
            href={wazeHref}
            className="inline-flex items-center justify-center rounded-md bg-[#33CCFF] px-3 py-2 text-sm font-medium text-white hover:bg-[#2BB5E0]"
          >
            <MapPinIcon className="w-4 h-4 mr-2" />
            Waze {sortedStops.length > 1 ? '(עצירה ראשונה)' : ''}
          </a>
        ) : null}

        {googleMapsHref ? (
          <a
            href={googleMapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-[#4285F4] px-3 py-2 text-sm font-medium text-white hover:bg-[#357ABD]"
          >
            <Navigation className="w-4 h-4 mr-2" />
            Google Maps {sortedStops.length > 1 ? '(כל העצירות)' : ''}
          </a>
        ) : null}
      </div>
    </div>
  );
}
