'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/auth';
import dayjs from '@/lib/dayjs';
import { useFeatureFlag } from '@/lib/useFeatureFlag';
import { FLAG_SIGNATURE_REQUIRED } from '@/lib/flagKeys';
import { SignaturePad } from '@/components/driver/SignaturePad';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { formatLicensePlate } from '@/lib/vehicleLicensePlate';

type TaskDetailsData = {
  id: string;
  title: string;
  type: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | null;
  details: string | null;
  estimated_start: string | null;
  estimated_end: string | null;
  address: string | null;
  client_name: string | null;
  vehicle_plate: string | null;
  vehicle_model: string | null;
  updated_at: string | null;
};

export function TaskDetails({ taskId }: { taskId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<TaskDetailsData | null>(null);
  const signatureRequired = useFeatureFlag(FLAG_SIGNATURE_REQUIRED);
  const [uploadedSignature, setUploadedSignature] = useState<{
    path: string;
    signedUrl?: string | null;
    bytes: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const supa = createBrowserClient();
        const { data, error } = (await supa.rpc('get_task_details', {
          task_id: taskId,
        })) as { data: TaskDetailsData[] | null; error: unknown | null };
        if (error) {
          throw error as Error;
        }
        if (mounted) {
          setTask(data && data[0] ? data[0] : null);
        }
      } catch {
        if (mounted) setError('טעינת המשימה נכשלה. נסה שוב.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [taskId]);

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="space-y-3">
        <div className="h-6 w-2/3 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
        <div className="h-24 w-full bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
        <div className="flex items-center justify-between">
          <span>אירעה שגיאה בטעינת המשימה</span>
          <button
            type="button"
            className="rounded-md bg-red-600 px-3 py-1 text-white text-sm"
            onClick={() => {
              // simple retry by reloading logic (simplified for now)
              window.location.reload();
            }}
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  if (!task) {
    return <div className="text-sm text-gray-600">המשימה לא נמצאה</div>;
  }

  const timeWindow =
    task.estimated_start && task.estimated_end
      ? `${dayjs(task.estimated_start).format('DD/MM/YYYY HH:mm')} – ${dayjs(
          task.estimated_end
        ).format('DD/MM/YYYY HH:mm')}`
      : task.estimated_end
      ? `עד ${dayjs(task.estimated_end).format('DD/MM/YYYY HH:mm')}`
      : 'ללא זמן יעד';

  const wazeHref = task.address
    ? `waze://?navigate=yes&q=${encodeURIComponent(task.address)}`
    : undefined;

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">{task.title}</CardTitle>
          <CardDescription>
            {task.type ?? '—'} • {task.priority ?? '—'} • {task.status ?? '—'}
          </CardDescription>
          <p className="text-xs text-gray-400">
            עודכן:{' '}
            {task.updated_at
              ? dayjs(task.updated_at).format('DD/MM/YYYY HH:mm')
              : '—'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {/* Details Block - only show for 'אחר' task type */}
          {task.type === 'אחר' && task.details && (
            <div className="bg-gray-50 p-3 rounded-md whitespace-pre-wrap text-gray-700">
              <div className="text-xs font-semibold text-gray-600 mb-2">
                תיאור המשימה:
              </div>
              <div>{task.details}</div>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">לקוח</div>
              <div className="font-medium">{task.client_name ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">רכב</div>
              <div className="font-medium">
                {task.vehicle_plate ? formatLicensePlate(task.vehicle_plate) : '—'}
                {task.vehicle_model && (
                  <span className="block text-xs font-normal text-gray-600">
                    {task.vehicle_model}
                  </span>
                )}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-gray-500 mb-1">חלון זמן</div>
              <div className="font-medium">{timeWindow}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-gray-500 mb-1">כתובת</div>
              <div className="font-medium">{task.address ?? '—'}</div>
              {wazeHref && (
                <a
                  href={wazeHref}
                  className="inline-flex mt-2 items-center justify-center rounded-md bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 w-full"
                >
                  ניווט עם Waze
                </a>
              )}
            </div>
          </div>
        </CardContent>

        {/* Actions Footer */}
        {task.status !== 'completed' && (
          <CardFooter className="flex flex-col gap-4 pt-2 border-t bg-gray-50/50 rounded-b-xl">
            {signatureRequired && (
              <div className="w-full space-y-2">
                <p className="text-sm text-gray-700 font-medium">חתימה נדרשת</p>
                <div className="border rounded-md bg-white overflow-hidden">
                  <SignaturePad
                    width={300}
                    height={160}
                    uploadBucket="signatures"
                    taskId={task.id}
                    onUploaded={(meta) => setUploadedSignature(meta)}
                  />
                </div>
                {uploadedSignature && (
                  <p className="text-xs text-green-600">✓ נחתם והועלה בהצלחה</p>
                )}
              </div>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
