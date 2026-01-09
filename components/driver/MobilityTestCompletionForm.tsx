'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { toastSuccess } from '@/lib/toast';
import {
  ImageUpload,
  UploadedImageMeta,
} from '@/components/driver/ImageUpload';
import type { DriverTask } from '@/components/driver/DriverHome';
import { Loader2 } from 'lucide-react';
import type { ExistingAttachments } from '@/lib/taskAttachments';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: DriverTask;
  onSubmit: () => Promise<void>;
  hasExistingAttachments?: ExistingAttachments;
}

export function MobilityTestCompletionForm({
  open,
  onOpenChange,
  task,
  onSubmit,
  hasExistingAttachments,
}: Props) {
  const [step, setStep] = useState(0); // 0: signed license, 1: km photo
  const [signedLicensePhoto, setSignedLicensePhoto] =
    useState<UploadedImageMeta | null>(null);
  const [kmPhoto, setKmPhoto] = useState<UploadedImageMeta | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleNext = () => {
    // Validate current step
    if (step === 0) {
      if (!signedLicensePhoto && !hasExistingAttachments?.hasSignedLicense) {
        // Optionally allow skipping if user explicitly wants to (but UI suggests flow)
        // For now, let's just warn but allow skipping if they really don't have it?
        // The requirements say: "לנהג צריכה להיות אפשרות לצלם תמונה באותו רגע ולהעלות אותה, או לדלג ולהעלות בשלב מאוחר יותר מהגלריה שלו."
        // This implies skipping the upload step entirely for now.
      }
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit();
      toastSuccess('המשימה הושלמה בהצלחה');
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      // toastError handled in parent usually, or we can show it here
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipToCompletion = async () => {
    // Check if we can just submit immediately
    await handleSubmit();
  };

  return (
    <div className="fixed inset-0 z-150 flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="border-b p-4 text-center">
          <h2 className="text-xl font-bold">
            סיום משימה - שלב {step + 1} מתוך 2
          </h2>
          <p className="text-sm text-gray-500">
            {step === 0 && 'צילום רשיון רכב חתום'}
            {step === 1 && 'צילום ק״מ עדכני'}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 0 && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                יש לצלם רשיון רכב חתום.
              </div>
              {hasExistingAttachments?.hasSignedLicense && (
                <div className="bg-green-50 p-3 rounded-lg text-sm text-green-800 mb-2">
                  נמצא צילום רשיון קיים. ניתן להעלות חדש או להמשיך.
                </div>
              )}
              <ImageUpload
                bucket="task-attachments"
                taskId={task.id}
                pathPrefix={`${task.id}/signed-license`}
                onUploaded={(files) => {
                  if (files.length > 0)
                    setSignedLicensePhoto(files[files.length - 1]);
                }}
                label="צלם/י רשיון חתום"
                multiple={false}
                capture="environment"
                maxSizeBytes={5 * 1024 * 1024}
              />
              {signedLicensePhoto && (
                <div className="mt-4 border rounded p-2">
                  <div className="relative h-48 w-full">
                    <Image
                      src={signedLicensePhoto.signedUrl || ''}
                      alt="Signed License"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <p className="text-center text-sm text-green-600 font-medium mt-1">
                    התמונה הועלתה בהצלחה
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                יש לצלם את מד הקילומטרים ברכב.
              </div>
              {hasExistingAttachments?.hasKmPhoto && (
                <div className="bg-green-50 p-3 rounded-lg text-sm text-green-800 mb-2">
                  נמצא צילום ק״מ קיים. ניתן להעלות חדש או להמשיך.
                </div>
              )}
              <ImageUpload
                bucket="task-attachments"
                taskId={task.id}
                pathPrefix={`${task.id}/km-photo`}
                onUploaded={(files) => {
                  if (files.length > 0) setKmPhoto(files[files.length - 1]);
                }}
                label="צלם/י ק״מ"
                multiple={false}
                capture="environment"
                maxSizeBytes={5 * 1024 * 1024}
              />
              {kmPhoto && (
                <div className="mt-4 border rounded p-2">
                  <div className="relative h-48 w-full">
                    <Image
                      src={kmPhoto.signedUrl || ''}
                      alt="KM Photo"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <p className="text-center text-sm text-green-600 font-medium mt-1">
                    התמונה הועלתה בהצלחה
                  </p>
                </div>
              )}
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

          {step < 1 ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleNext} // Skip allowed
                className="text-gray-500 hover:text-gray-700 text-sm px-3"
              >
                דלג לשלב הבא
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                המשך
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSubmit} // Allow skip/finish without upload
                className="text-gray-500 hover:text-gray-700 text-sm px-3"
              >
                דלג בלי להעלות{' '}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                סיים משימה
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
