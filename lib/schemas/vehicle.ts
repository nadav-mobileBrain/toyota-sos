import { z } from 'zod';
import { isValidLicensePlate } from '@/lib/vehicleLicensePlate';

export const vehicleSchema = z.object({
  license_plate: z
    .string()
    .trim()
    .min(1, 'מספר רישוי הוא שדה חובה')
    .refine(
      (val) => isValidLicensePlate(val),
      'מספר רישוי חייב להכיל 7 או 8 ספרות'
    ),
  model: z
    .string()
    .trim()
    .max(100, 'מודל לא יכול להכיל יותר מ-100 תווים')
    .optional(),
  is_available: z.boolean().default(true),
  unavailability_reason: z
    .string()
    .trim()
    .max(500, 'סיבת אי זמינות לא יכולה להכיל יותר מ-500 תווים')
    .optional()
    .nullable(),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

