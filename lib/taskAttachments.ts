import { createBrowserClient } from '@/lib/auth';

export interface ExistingAttachments {
  hasCarImages: boolean;
  hasLicense: boolean;
  hasSignature: boolean;
  hasAllRequired: boolean;
}

/**
 * Check if a task has existing attachments (car images, license, signature)
 */
export async function checkExistingAttachments(
  taskId: string
): Promise<ExistingAttachments> {
  const supa = createBrowserClient();
  const result: ExistingAttachments = {
    hasCarImages: false,
    hasLicense: false,
    hasSignature: false,
    hasAllRequired: false,
  };

  try {
    // Check for car images
    try {
      const { data: carImagesList } = await supa.storage
        .from('task-attachments')
        .list(`${taskId}/car-images`, {
          limit: 1,
        });
      result.hasCarImages = carImagesList && carImagesList.length > 0;
    } catch {
      // Folder doesn't exist, that's ok
    }

    // Check for license
    try {
      const { data: licenseList } = await supa.storage
        .from('task-attachments')
        .list(`${taskId}/client-license`, {
          limit: 1,
        });
      result.hasLicense = licenseList && licenseList.length > 0;
    } catch {
      // Folder doesn't exist, that's ok
    }

    // Check for signature in DB
    const { data: signaturesData } = await supa
      .from('signatures')
      .select('id')
      .eq('task_id', taskId)
      .limit(1);

    result.hasSignature = signaturesData && signaturesData.length > 0;

    // Also check storage directly for signatures folder
    if (!result.hasSignature) {
      try {
        const { data: signaturesList } = await supa.storage
          .from('task-attachments')
          .list(`${taskId}/signatures`, {
            limit: 1,
          });
        result.hasSignature = signaturesList && signaturesList.length > 0;
      } catch {
        // Folder doesn't exist, that's ok
      }
    }

    result.hasAllRequired =
      result.hasCarImages && result.hasLicense && result.hasSignature;
  } catch (error) {
    console.error('Error checking existing attachments:', error);
  }

  return result;
}

