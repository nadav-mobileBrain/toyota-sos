import { createBrowserClient } from '@/lib/auth';

export interface ExistingAttachments {
  hasCarImages: boolean;
  hasLicense: boolean;
  hasSignature: boolean;
  hasSignedLicense: boolean;
  hasKmPhoto: boolean;
  hasAllRequired: boolean;
}

/**
 * Check if a task has existing attachments (car images, license, signature, signed license, km photo)
 */
export async function checkExistingAttachments(
  taskId: string
): Promise<ExistingAttachments> {
  const supa = createBrowserClient();

  const [
    carImagesResult,
    licenseResult,
    signedLicenseResult,
    kmPhotoResult,
    signaturesDbResult,
    signaturesStorageResult,
  ] = await Promise.allSettled([
    // 1. Check for car images
    supa.storage
      .from('task-attachments')
      .list(`${taskId}/car-images`, { limit: 1 }),

    // 2. Check for license
    supa.storage
      .from('task-attachments')
      .list(`${taskId}/client-license`, { limit: 1 }),

    // 3. Check for signed license (for mobility test)
    supa.storage
      .from('task-attachments')
      .list(`${taskId}/signed-license`, { limit: 1 }),

    // 4. Check for KM photo (for mobility test)
    supa.storage
      .from('task-attachments')
      .list(`${taskId}/km-photo`, { limit: 1 }),

    // 5. Check for signature in DB
    supa.from('signatures').select('id').eq('task_id', taskId).limit(1),

    // 6. Check for signatures in storage
    supa.storage
      .from('task-attachments')
      .list(`${taskId}/signatures`, { limit: 1 }),
  ]);

  const hasCarImages =
    carImagesResult.status === 'fulfilled' &&
    !!(carImagesResult.value.data && carImagesResult.value.data.length > 0);

  const hasLicense =
    licenseResult.status === 'fulfilled' &&
    !!(licenseResult.value.data && licenseResult.value.data.length > 0);

  const hasSignedLicense =
    signedLicenseResult.status === 'fulfilled' &&
    !!(
      signedLicenseResult.value.data &&
      signedLicenseResult.value.data.length > 0
    );

  const hasKmPhoto =
    kmPhotoResult.status === 'fulfilled' &&
    !!(kmPhotoResult.value.data && kmPhotoResult.value.data.length > 0);

  const hasSignatureInDb =
    signaturesDbResult.status === 'fulfilled' &&
    !!(
      signaturesDbResult.value.data && signaturesDbResult.value.data.length > 0
    );

  const hasSignatureInStorage =
    signaturesStorageResult.status === 'fulfilled' &&
    !!(
      signaturesStorageResult.value.data &&
      signaturesStorageResult.value.data.length > 0
    );

  const hasSignature = hasSignatureInDb || hasSignatureInStorage;

  return {
    hasCarImages,
    hasLicense,
    hasSignature,
    hasSignedLicense,
    hasKmPhoto,
    hasAllRequired: hasCarImages && hasLicense && hasSignature,
  };
}
