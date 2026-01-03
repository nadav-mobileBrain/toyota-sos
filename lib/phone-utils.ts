/**
 * Formats a phone number as Israeli mobile (05X-XXXXXXX) or home (0X-XXXXXXX) while typing.
 */
export function formatIsraeliPhone(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  
  // If it starts with something else than 0, it's invalid for this format but we'll let it be for now
  if (digits[0] !== '0') return digits;

  // Mobile: 05X-XXXXXXX
  if (digits[1] === '5' && digits.length > 2) {
    const prefix = digits.slice(0, 3);
    const rest = digits.slice(3, 10);
    return rest ? `${prefix}-${rest}` : prefix;
  }
  
  // Home: 0X-XXXXXXX (X is not 5)
  if (digits[1] !== '5' && digits.length > 1) {
    const prefix = digits.slice(0, 2);
    const rest = digits.slice(2, 9);
    return rest ? `${prefix}-${rest}` : prefix;
  }

  return digits;
}

/**
 * Validates an Israeli mobile or home phone number.
 */
export function validateIsraeliPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  
  // Mobile: 05X-XXXXXXX (10 digits)
  if (digits.startsWith('05')) {
    return /^\d{10}$/.test(digits);
  }
  
  // Home: 0X-XXXXXXX (9 digits)
  if (digits.startsWith('0')) {
    return /^\d{9}$/.test(digits);
  }
  
  return false;
}
