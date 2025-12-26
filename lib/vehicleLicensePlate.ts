/**
 * Formats a vehicle license plate according to Israeli standards:
 * - 8 digits: 3-2-3 format (e.g., 123-45-678)
 * - 7 digits: 2-3-3 format (e.g., 12-345-67)
 * - Other lengths: returns as-is (for invalid data)
 *
 * @param plate - The license plate number (may contain dashes or spaces)
 * @returns Formatted license plate string
 */
export function formatLicensePlate(plate: string | null | undefined): string {
  if (!plate) return '';

  // Remove all non-digit characters (dashes, spaces, etc.)
  const digitsOnly = plate.replace(/\D/g, '');

  // Format based on digit count
  if (digitsOnly.length === 8) {
    // 3-2-3 format
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 5)}-${digitsOnly.slice(5, 8)}`;
  } else if (digitsOnly.length === 7) {
    // 2-3-3 format
    return `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2, 5)}-${digitsOnly.slice(5, 7)}`;
  }

  // Return original if not 7 or 8 digits (invalid format)
  return plate;
}

/**
 * Validates that a license plate has the correct format (7 or 8 digits)
 *
 * @param plate - The license plate number (may contain dashes or spaces)
 * @returns true if valid (7 or 8 digits), false otherwise
 */
export function isValidLicensePlate(plate: string | null | undefined): boolean {
  if (!plate) return false;

  const digitsOnly = plate.replace(/\D/g, '');
  return digitsOnly.length === 7 || digitsOnly.length === 8;
}

/**
 * Normalizes a license plate by removing all non-digit characters
 * Useful for storing in database or comparing plates
 *
 * @param plate - The license plate number (may contain dashes or spaces)
 * @returns Digits-only string, or empty string if invalid
 */
export function normalizeLicensePlate(plate: string | null | undefined): string {
  if (!plate) return '';

  const digitsOnly = plate.replace(/\D/g, '');
  // Only return if valid length
  if (digitsOnly.length === 7 || digitsOnly.length === 8) {
    return digitsOnly;
  }

  return '';
}

