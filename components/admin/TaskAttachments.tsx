'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/auth';
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';

interface TaskAttachment {
  id: string;
  url: string;
  signedUrl: string | null;
  type: 'image' | 'signature';
  description?: string | null;
}

interface TaskAttachmentsProps {
  taskId: string;
  taskType: string;
}

export function TaskAttachments({ taskId, taskType }: TaskAttachmentsProps) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reset attachments when taskId changes to prevent showing wrong task's attachments
    setAttachments([]);
    setLoading(true);
    
    if (taskType !== 'מסירת רכב חלופי') {
      setLoading(false);
      return;
    }

    const loadAttachments = async () => {
      try {
        const supa = createBrowserClient();
        const allAttachments: TaskAttachment[] = [];

        // Load signatures from DB - ONLY for this specific task
        const { data: signaturesData, error: signaturesError } = await supa
          .from('signatures')
          .select('id, signature_url, signed_by_name')
          .eq('task_id', taskId)
          .order('signed_at', { ascending: true });
        
        // Debug: log what we're loading
        if (signaturesData && signaturesData.length > 0) {
          console.debug(`[TaskAttachments] Loading ${signaturesData.length} signatures for task ${taskId}`);
        }

        if (!signaturesError && signaturesData && signaturesData.length > 0) {
          for (const sig of signaturesData) {
            try {
              // Extract path from signature_url (format: task-attachments/path or just path)
              let path = sig.signature_url;
              if (path.startsWith('task-attachments/')) {
                path = path.replace('task-attachments/', '');
              }
              
              const { data: signedData, error: signError } = await supa.storage
                .from('task-attachments')
                .createSignedUrl(path, 3600); // 1 hour expiry

              if (!signError && signedData?.signedUrl) {
                allAttachments.push({
                  id: sig.id,
                  url: sig.signature_url,
                  signedUrl: signedData.signedUrl,
                  type: 'signature',
                  description: sig.signed_by_name || 'חתימת לקוח',
                });
              } else {
                console.warn('Failed to create signed URL for signature:', sig.id, signError);
              }
            } catch (err) {
              console.error('Error processing signature:', sig.id, err);
            }
          }
        }

        // Also check storage directly for signatures folder (in case they're not in DB)
        // IMPORTANT: Only load from this specific task's folder
        try {
          const { data: signaturesList } = await supa.storage
            .from('task-attachments')
            .list(`${taskId}/signatures`, {
              limit: 100,
              sortBy: { column: 'created_at', order: 'asc' },
            });

          if (signaturesList && signaturesList.length > 0) {
            console.debug(`[TaskAttachments] Found ${signaturesList.length} signature files in storage for task ${taskId}`);
            for (const file of signaturesList) {
              // Skip if already in attachments (from DB) - check by exact URL match
              const path = `${taskId}/signatures/${file.name}`;
              const url = `task-attachments/${path}`;
              
              // More strict check - verify the URL matches exactly
              if (
                !allAttachments.some(
                  (a) =>
                    a.type === 'signature' &&
                    (a.url === url || a.url.includes(`/${taskId}/signatures/${file.name}`))
                )
              ) {
                const { data: signedData } = await supa.storage
                  .from('task-attachments')
                  .createSignedUrl(path, 3600);

                allAttachments.push({
                  id: `sig-${taskId}-${file.name}`,
                  url: url,
                  signedUrl: signedData?.signedUrl || null,
                  type: 'signature',
                  description: 'חתימת לקוח',
                });
              } else {
                console.debug(`[TaskAttachments] Skipping duplicate signature: ${file.name}`);
              }
            }
          }
        } catch (err) {
          // Folder might not exist, that's ok
          console.debug(`[TaskAttachments] No signatures folder found for task ${taskId}:`, err);
        }

        // Check storage directly for car images (from car-images folder)
        // IMPORTANT: Only load from this specific task's folder
        try {
          const { data: carImagesList } = await supa.storage
            .from('task-attachments')
            .list(`${taskId}/car-images`, {
              limit: 100,
              sortBy: { column: 'created_at', order: 'asc' },
            });

          if (carImagesList && carImagesList.length > 0) {
            console.debug(`[TaskAttachments] Found ${carImagesList.length} car images in storage for task ${taskId}`);
            for (const file of carImagesList) {
              const path = `${taskId}/car-images/${file.name}`;
              // Skip if already exists (check by exact URL match)
              const url = `task-attachments/${path}`;
              if (allAttachments.some((a) => a.url === url || a.url.includes(`/${taskId}/car-images/${file.name}`))) {
                console.debug(`[TaskAttachments] Skipping duplicate car image: ${file.name}`);
                continue;
              }
              const { data: signedData } = await supa.storage
                .from('task-attachments')
                .createSignedUrl(path, 3600);

              allAttachments.push({
                id: `car-${taskId}-${file.name}`,
                url: url,
                signedUrl: signedData?.signedUrl || null,
                type: 'image',
                description: null,
              });
            }
          }
        } catch (err) {
          // Folder might not exist, that's ok
          console.debug(`[TaskAttachments] No car-images folder found for task ${taskId}:`, err);
        }

        // Check for client-license folder
        // IMPORTANT: Only load from this specific task's folder
        try {
          const { data: licenseList } = await supa.storage
            .from('task-attachments')
            .list(`${taskId}/client-license`, {
              limit: 100,
              sortBy: { column: 'created_at', order: 'asc' },
            });

          if (licenseList && licenseList.length > 0) {
            console.debug(`[TaskAttachments] Found ${licenseList.length} license images in storage for task ${taskId}`);
            for (const file of licenseList) {
              const path = `${taskId}/client-license/${file.name}`;
              // Skip if already exists (check by exact URL match)
              const url = `task-attachments/${path}`;
              if (allAttachments.some((a) => a.url === url || a.url.includes(`/${taskId}/client-license/${file.name}`))) {
                console.debug(`[TaskAttachments] Skipping duplicate license image: ${file.name}`);
                continue;
              }
              const { data: signedData } = await supa.storage
                .from('task-attachments')
                .createSignedUrl(path, 3600);

              allAttachments.push({
                id: `license-${taskId}-${file.name}`,
                url: url,
                signedUrl: signedData?.signedUrl || null,
                type: 'image',
                description: null,
              });
            }
          }
        } catch (err) {
          // Folder might not exist, that's ok
          console.debug(`[TaskAttachments] No client-license folder found for task ${taskId}:`, err);
        }

        // Final deduplication by URL to ensure no duplicates
        const uniqueAttachments = allAttachments.reduce((acc, attachment) => {
          const existing = acc.find((a) => a.url === attachment.url);
          if (!existing) {
            acc.push(attachment);
          } else {
            console.debug(`[TaskAttachments] Removing duplicate attachment: ${attachment.url}`);
          }
          return acc;
        }, [] as TaskAttachment[]);

        console.debug(`[TaskAttachments] Final attachments for task ${taskId}:`, {
          total: uniqueAttachments.length,
          images: uniqueAttachments.filter((a) => a.type === 'image').length,
          signatures: uniqueAttachments.filter((a) => a.type === 'signature').length,
        });

        setAttachments(uniqueAttachments);
      } catch (error) {
        console.error('Error loading attachments:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAttachments();
  }, [taskId, taskType]);

  if (taskType !== 'מסירת רכב חלופי' || loading) {
    return null;
  }

  if (attachments.length === 0) {
    return null;
  }

  // Separate images and signatures
  const images = attachments.filter((a) => a.type === 'image');
  const signatures = attachments.filter((a) => a.type === 'signature');

  return (
    <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
      {/* Images */}
      {images.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-600">תמונות:</div>
          <div className="grid grid-cols-3 gap-1.5">
            {images.map((img, index) => (
              <a
                key={img.id}
                href={img.signedUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline rounded px-1.5 py-0.5 hover:bg-blue-50 transition-colors min-w-0"
                onClick={(e) => {
                  if (!img.signedUrl) {
                    e.preventDefault();
                  }
                }}
              >
                {img.signedUrl && (
                  <div className="relative w-6 h-6 rounded border border-gray-200 overflow-hidden bg-gray-100 shrink-0">
                    <Image
                      src={img.signedUrl}
                      alt={`תמונה ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="24px"
                      unoptimized
                    />
                  </div>
                )}
                <span className="whitespace-nowrap truncate">תמונה {index + 1}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Signatures */}
      {signatures.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-600">חתימות:</div>
          <div className="grid grid-cols-3 gap-1.5">
            {signatures.map((sig) => (
              <a
                key={sig.id}
                href={sig.signedUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline rounded px-1.5 py-0.5 hover:bg-blue-50 transition-colors min-w-0"
                onClick={(e) => {
                  if (!sig.signedUrl) {
                    e.preventDefault();
                  }
                }}
              >
                {sig.signedUrl && (
                  <div className="relative w-6 h-6 rounded border border-gray-200 overflow-hidden bg-gray-100 shrink-0">
                    <Image
                      src={sig.signedUrl}
                      alt="חתימת לקוח"
                      fill
                      className="object-contain bg-white"
                      sizes="24px"
                      unoptimized
                    />
                  </div>
                )}
                <span className="whitespace-nowrap truncate">
                  {sig.description || 'חתימת לקוח'}
                </span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

