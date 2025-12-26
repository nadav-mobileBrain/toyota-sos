'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { createBrowserClient, getDriverSession } from '@/lib/auth';
import { toastSuccess } from '@/lib/toast';
import {
  ImageUpload,
  UploadedImageMeta,
} from '@/components/driver/ImageUpload';
import type { DriverTask } from '@/components/driver/DriverHome';
import SignaturePad from 'signature_pad';
import { Loader2 } from 'lucide-react';
import { trackSignatureCaptured } from '@/lib/events';
import type { ExistingAttachments } from '@/lib/taskAttachments';
import { formatLicensePlate } from '@/lib/vehicleLicensePlate';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: DriverTask;
  onSubmit: () => Promise<void>;
  hasExistingAttachments?: ExistingAttachments;
}

export function ReplacementCarDeliveryForm({
  open,
  onOpenChange,
  task,
  onSubmit,
  hasExistingAttachments,
}: Props) {
  const [step, setStep] = useState(0); // 0: car photos, 1: license, 2: summary & signature
  const [carPhotos, setCarPhotos] = useState<UploadedImageMeta[]>([]);
  const [licensePhoto, setLicensePhoto] = useState<UploadedImageMeta | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  // Signature Pad refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  // Focus trap
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && step === 2 && canvasRef.current) {
      // Initialize signature pad when on step 2
      const canvas = canvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);

      if (!signaturePadRef.current) {
        signaturePadRef.current = new SignaturePad(canvas, {
          backgroundColor: 'rgb(255, 255, 255)',
          penColor: 'rgb(0, 0, 0)',
        });
      } else {
        signaturePadRef.current.clear();
      }

      // Handle resize
      const resizeHandler = () => {
        if (canvasRef.current) {
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          const c = canvasRef.current;
          c.width = c.offsetWidth * ratio;
          c.height = c.offsetHeight * ratio;
          c.getContext('2d')?.scale(ratio, ratio);
          signaturePadRef.current?.clear(); // Resizing clears canvas usually
        }
      };
      window.addEventListener('resize', resizeHandler);
      return () => window.removeEventListener('resize', resizeHandler);
    }
  }, [open, step]);

  if (!open) return null;

  const handleNext = () => {
    // Allow skipping if existing attachments are present
    if (step === 0) {
      if (carPhotos.length === 0 && !hasExistingAttachments?.hasCarImages) {
        alert('יש להעלות לפחות תמונה אחת של הרכב');
        return;
      }
    }
    if (step === 1) {
      if (!licensePhoto && !hasExistingAttachments?.hasLicense) {
        alert('יש להעלות צילום רישיון נהיגה');
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const handleSkipToCompletion = async () => {
    // If all attachments exist, allow skipping directly to completion
    if (
      hasExistingAttachments?.hasAllRequired &&
      (hasExistingAttachments.hasCarImages ||
        carPhotos.length > 0) &&
      (hasExistingAttachments.hasLicense || licensePhoto) &&
      hasExistingAttachments.hasSignature
    ) {
      await onSubmit();
      toastSuccess('משימת מסירת רכב הושלמה בהצלחה');
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    setStep((s) => s - 1);
  };

  const clearSignature = () => {
    signaturePadRef.current?.clear();
  };

  const handleSubmit = async () => {
    // If signature already exists and user didn't add a new one, skip signature upload
    const hasNewSignature = !signaturePadRef.current?.isEmpty();
    const hasExistingSignature = hasExistingAttachments?.hasSignature;

    if (!hasNewSignature && !hasExistingSignature) {
      setSignatureError('יש לחתום כדי להמשיך');
      return;
    }

    setSubmitting(true);
    setSignatureError(null);

    try {
      // 1. Upload signature only if user provided a new one
      if (hasNewSignature) {
        const dataUrl = signaturePadRef.current?.toDataURL('image/png');
        if (!dataUrl) throw new Error('Failed to get signature');

        const blob = await (await fetch(dataUrl)).blob();
        const supa = createBrowserClient();
        const filename = `signature-${Date.now()}.png`;
        const path = `${task.id}/signatures/${filename}`;

        const { error: uploadError } = await supa.storage
          .from('task-attachments')
          .upload(path, blob, {
            contentType: 'image/png',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const storagePath = `task-attachments/${path}`;

        // For local session drivers, get ID from session
        const driverSession = getDriverSession();
        const userId =
          driverSession?.userId || (await supa.auth.getUser()).data.user?.id;

        if (!userId) {
          throw new Error('User not identified');
        }

        const { error: dbError } = await supa.from('signatures').insert({
          task_id: task.id,
          driver_id: userId,
          signature_url: storagePath,
          signed_by_name: task.clientName || 'Client',
          signed_at: new Date().toISOString(),
        });

        if (dbError) {
          console.error('Failed to save signature to DB', dbError);
          throw new Error('שמירת החתימה נכשלה');
        }

        // Analytics
        try {
          trackSignatureCaptured({
            task_id: task.id,
            method: 'upload',
            bytes: blob.size,
            storage_path: storagePath,
            width: canvasRef.current?.width || 0,
            height: canvasRef.current?.height || 0,
          });
        } catch {}
      }

      // 2. Call parent submit (update status)
      await onSubmit();
      toastSuccess('משימת מסירת רכב הושלמה בהצלחה');
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      setSignatureError(
        err instanceof Error ? err.message : 'אירעה שגיאה בשמירה'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-150 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={panelRef}
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="border-b p-4 text-center">
          <h2 className="text-xl font-bold">
            מסירת רכב חלופי - שלב {step + 1} מתוך 3
          </h2>
          <p className="text-sm text-gray-500">
            {step === 0 && 'צילום הרכב'}
            {step === 1 && 'צילום רישיון נהיגה'}
            {step === 2 && 'אישור וחתימה'}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 0 && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                יש לצלם את הרכב מכל הצדדים (לפחות תמונה אחת).
              </div>
              <ImageUpload
                bucket="task-attachments"
                taskId={task.id}
                pathPrefix={`${task.id}/car-images`}
                onUploaded={(files) =>
                  setCarPhotos((prev) => [...prev, ...files])
                }
                onChange={() => {
                  // ImageUpload manages its own "items" state, but also calls onChange with current list.
                  // We rely on onUploaded for confirmed uploads.
                }}
                label="צלם/י תמונות"
                multiple
                capture="environment"
                maxSizeBytes={500 * 1024}
              />
              {carPhotos.length > 0 && (
                <div className="text-sm text-green-600 mt-2 font-medium">
                  {carPhotos.length} תמונות הועלו בהצלחה
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                יש לצלם את רישיון הנהיגה של הלקוח.
              </div>
              <ImageUpload
                bucket="task-attachments"
                taskId={task.id}
                pathPrefix={`${task.id}/client-license`}
                onUploaded={(files) => {
                  if (files.length > 0)
                    setLicensePhoto(files[files.length - 1]);
                }}
                label="צלם/י רישיון"
                multiple={false}
                capture="environment"
                maxSizeBytes={5 * 1024 * 1024}
              />
              {licensePhoto && (
                <div className="text-sm text-green-600 mt-2 font-medium">
                  רישיון הועלה בהצלחה
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">פרטי רכב</h3>
                <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 p-3 rounded-lg">
                  <div>
                    <span className="text-gray-500 block">מספר רכב:</span>
                    <span className="font-mono font-medium">
                      {task.vehicle?.licensePlate
                        ? formatLicensePlate(task.vehicle.licensePlate)
                        : 'לא ידוע'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">דגם:</span>
                    <span className="font-medium">
                      {task.vehicle?.model || 'לא ידוע'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">סיכום מסמכים</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {carPhotos.map((p, i) => (
                    <div
                      key={i}
                      className="w-16 h-16 rounded bg-gray-200 shrink-0 border overflow-hidden relative"
                    >
                      {p.signedUrl && (
                        <Image
                          src={p.signedUrl}
                          alt="car"
                          className="object-cover"
                          fill
                          sizes="64px"
                          unoptimized
                        />
                      )}
                    </div>
                  ))}
                  {licensePhoto && (
                    <div className="w-16 h-16 rounded bg-gray-200 shrink-0 border overflow-hidden relative">
                      {licensePhoto.signedUrl && (
                        <Image
                          src={licensePhoto.signedUrl}
                          alt="license"
                          className="object-cover"
                          fill
                          sizes="64px"
                          unoptimized
                        />
                      )}
                      <span className="absolute bottom-0 w-full bg-black/50 text-[10px] text-white text-center">
                        רישיון
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">חתימת לקוח</h3>
                {hasExistingAttachments?.hasSignature && (
                  <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 mb-2">
                    נמצאה חתימה קיימת. ניתן לחתום חתימה חדשה או להמשיך עם הקיימת.
                  </div>
                )}
                <p className="text-sm text-gray-600">
                  אני מאשר קבלת הרכב החלופי המפורט לעיל.
                </p>
                <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden touch-none relative h-48 bg-white">
                  <canvas ref={canvasRef} className="w-full h-full block" />
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="absolute top-2 left-2 text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                  >
                    נקה
                  </button>
                </div>
                {signatureError && (
                  <p className="text-red-600 text-sm">{signatureError}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-between bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={step === 0 ? () => onOpenChange(false) : handleBack}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            disabled={submitting}
          >
            {step === 0 ? 'ביטול' : 'חזור'}
          </button>

          <div className="flex gap-2">
            {step === 0 &&
              hasExistingAttachments?.hasAllRequired &&
              (hasExistingAttachments.hasCarImages ||
                carPhotos.length > 0) &&
              (hasExistingAttachments.hasLicense || licensePhoto) &&
              hasExistingAttachments.hasSignature && (
                <button
                  type="button"
                  onClick={handleSkipToCompletion}
                  disabled={submitting}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                >
                  דלג והשתמש בתמונות קיימות
                </button>
              )}

            {step < 2 ? (
              <button
                type="button"
                onClick={handleNext}
                className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                המשך
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                סיים ומסור רכב
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
