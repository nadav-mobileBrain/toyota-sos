import { z } from 'zod';

// Shared admin creation schema (admin side)
export const adminSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'שם חייב להכיל לפחות 2 תווים')
    .max(100, 'שם לא יכול להכיל יותר מ-100 תווים'),
  employeeId: z
    .string()
    .trim()
    .min(2, 'מספר עובד חייב להכיל לפחות 2 ספרות')
    .max(20, 'מספר עובד לא יכול להכיל יותר מ-20 ספרות')
    .regex(/^\d+$/, 'מספר עובד חייב להכיל רק ספרות'),
  // Optional email; empty string will be treated as undefined in the UI layer
  email: z
    .string()
    .email('אימייל לא תקין')
    .max(255, 'אימייל לא יכול להכיל יותר מ-255 תווים')
    .optional(),
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

