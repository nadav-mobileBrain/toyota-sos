'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@/lib/auth';
import { ImageUpload, UploadedImageMeta } from '@/components/driver/ImageUpload';
import type { DriverTask } from '@/components/driver/DriverHome';
import SignaturePad from 'signature_pad';
import { Loader2 } from 'lucide-react';
import { trackSignatureCaptured } from '@/lib/events';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: DriverTask;
  onSubmit: () => Promise<void>;
}

export function ReplacementCarDeliveryForm({
  open,
  onOpenChange,
  task,
  onSubmit,
}: Props) {
  const [step, setStep] = useState(0); // 0: car photos, 1: license, 2: summary & signature
  const [carPhotos, setCarPhotos] = useState<UploadedImageMeta[]>([]);
  const [licensePhoto, setLicensePhoto] = useState<UploadedImageMeta | null>(null);
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
         if(canvasRef.current){
             const ratio = Math.max(window.devicePixelRatio || 1, 1);
             const c = canvasRef.current;
             c.width = c.offsetWidth * ratio;
             c.height = c.offsetHeight * ratio;
             c.getContext('2d')?.scale(ratio, ratio);
             signaturePadRef.current?.clear(); // Resizing clears canvas usually
         }
      }
      window.addEventListener('resize', resizeHandler);
      return () => window.removeEventListener('resize', resizeHandler);
    }
  }, [open, step]);

  if (!open) return null;

  const handleNext = () => {
    if (step === 0 && carPhotos.length === 0) {
      alert('יש להעלות לפחות תמונה אחת של הרכב');
      return;
    }
    if (step === 1 && !licensePhoto) {
      alert('יש להעלות צילום רישיון נהיגה');
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => s - 1);
  };

  const clearSignature = () => {
    signaturePadRef.current?.clear();
  };

  const handleSubmit = async () => {
    if (signaturePadRef.current?.isEmpty()) {
      setSignatureError('יש לחתום כדי להמשיך');
      return;
    }
    setSubmitting(true);
    setSignatureError(null);

    try {
      // 1. Upload signature
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
            upsert: true
        });

      if (uploadError) throw uploadError;

      // 2. Save signature metadata to DB (signatures table)
      // We can do this or rely on the storage. But typical pattern in this codebase involves DB records.
      // The instructions said "Store in signatures table".
      // Let's create a public signed URL or just store the path if the system uses private buckets.
      // Since RLS allows authenticated users, we can store the path.
      
      // We need signature_url. Let's get a public URL or signed URL. 
      // Assuming we store the path or a long-lived signed URL. 
      // The `signatures` table has `signature_url`. 
      
      // Let's store the path for now, or generates a signed url.
      // Since bucket is private-ish (authenticated only), we might need signed URL.
      // But typically we store the path and generate signed URL on read.
      // However, `signatures` table expects `signature_url` (text).
      
      const { data: { publicUrl } } = supa.storage.from('task-attachments').getPublicUrl(path);
      // NOTE: Bucket is private, publicUrl won't work for unauthenticated. 
      // But if we need it for admin panel, storing the path and resolving later is better.
      // For this implementation, I will store the path prefixed with `storage://` or just the path, 
      // or if the table is used for display directly, maybe I should insert a signed URL? 
      // Signed URLs expire. Best practice: store path.
      // But `signatures` table definition says `signature_url`.
      // Let's store the full storage path: `task-attachments/path`.
      
      const storagePath = `task-attachments/${path}`;

      const { error: dbError } = await supa.from('signatures').insert({
        task_id: task.id,
        driver_id: (await supa.auth.getUser()).data.user?.id, // best effort
        signature_url: storagePath, 
        signed_by_name: task.clientName || 'Client',
        signed_at: new Date().toISOString()
      });

      if (dbError) {
         console.error('Failed to save signature to DB', dbError);
         // Continue anyway? The file is in storage. 
         // Let's warn but continue or fail?
         // User said "Store in signatures table". So we should fail if this fails.
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

      // 3. Call parent submit (update status)
      await onSubmit();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      setSignatureError(err.message || 'אירעה שגיאה בשמירה');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div 
        ref={panelRef}
        className="w-full max-w-lg rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="border-b p-4 text-center">
          <h2 className="text-xl font-bold">מסירת רכב חלופי - שלב {step + 1} מתוך 3</h2>
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
                onUploaded={(files) => setCarPhotos(prev => [...prev, ...files])}
                onChange={(files) => {
                   // ImageUpload manages its own "items" state, but also calls onChange with current list.
                   // We rely on onUploaded for confirmed uploads.
                }}
                label="צלם/י תמונות"
                multiple
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
                    if (files.length > 0) setLicensePhoto(files[files.length - 1]);
                }}
                label="צלם/י רישיון"
                multiple={false}
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
                    <span className="font-mono font-medium">{task.vehicle?.licensePlate || 'לא ידוע'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">דגם:</span>
                    <span className="font-medium">{task.vehicle?.model || 'לא ידוע'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">סיכום מסמכים</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {carPhotos.map((p, i) => (
                        <div key={i} className="w-16 h-16 rounded bg-gray-200 shrink-0 border overflow-hidden">
                             {/* eslint-disable-next-line @next/next/no-img-element */}
                            {p.signedUrl && <img src={p.signedUrl} alt="car" className="w-full h-full object-cover" />}
                        </div>
                    ))}
                    {licensePhoto && (
                        <div className="w-16 h-16 rounded bg-gray-200 shrink-0 border overflow-hidden relative">
                             {/* eslint-disable-next-line @next/next/no-img-element */}
                            {licensePhoto.signedUrl && <img src={licensePhoto.signedUrl} alt="license" className="w-full h-full object-cover" />}
                             <span className="absolute bottom-0 w-full bg-black/50 text-[10px] text-white text-center">רישיון</span>
                        </div>
                    )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">חתימת לקוח</h3>
                <p className="text-sm text-gray-600">
                  אני מאשר קבלת הרכב החלופי המפורט לעיל.
                </p>
                <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden touch-none relative h-48 bg-white">
                  <canvas 
                    ref={canvasRef} 
                    className="w-full h-full block"
                  />
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
  );
}

