import { z } from 'zod';

// Shared admin creation schema (admin side)
export const adminSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'שם חייב להכיל לפחות 2 תווים')
    .max(100, 'שם לא יכול להכיל יותר מ-100 תווים'),
  // Optional employeeId
  employeeId: z
    .union([
      z.string()
        .trim()
        .min(2, 'מספר עובד חייב להכיל לפחות 2 ספרות')
        .max(20, 'מספר עובד לא יכול להכיל יותר מ-20 ספרות')
        .regex(/^\d+$/, 'מספר עובד חייב להכיל רק ספרות'),
      z.literal(''),
      z.undefined(),
    ])
    .transform((val) => {
      if (!val || val.trim().length === 0) return undefined;
      return val.trim();
    })
    .optional(),
  // Required email
  email: z
    .string()
    .trim()
    .min(1, 'אימייל הוא שדה חובה')
    .email('אימייל לא תקין')
    .max(255, 'אימייל לא יכול להכיל יותר מ-255 תווים'),
  // Required password (only for creation)
  password: z
    .string()
    .min(6, 'סיסמה חייבת להכיל לפחות 6 תווים')
    .max(100, 'סיסמה לא יכולה להכיל יותר מ-100 תווים')
    .or(z.literal(''))
    .optional(), // Optional to support edit flow where password isn't required
  role: z.enum(['admin', 'manager', 'viewer'], {
    error: (issue: any) => {
      if (issue.code === 'invalid_type' && issue.received === 'undefined') {
        return { message: 'יש לבחור תפקיד' };
      }
      return { message: 'תפקיד לא תקין' };
    },
  }),
});

export type AdminInput = z.infer<typeof adminSchema>;

