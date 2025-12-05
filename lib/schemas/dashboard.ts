import { z } from 'zod';

// Dashboard query parameter validation
export const dashboardDetailsQuerySchema = z
  .object({
    metric: z.enum(
      ['created', 'completed', 'overdue', 'on_time', 'late', 'scheduled'],
      {
        message: 'מטריקה לא תקינה',
      }
    ),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך התחלה חייב להיות בפורמט YYYY-MM-DD')
      .refine((date) => !isNaN(Date.parse(date)), 'תאריך התחלה לא תקין'),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך סיום חייב להיות בפורמט YYYY-MM-DD')
      .refine((date) => !isNaN(Date.parse(date)), 'תאריך סיום לא תקין'),
    tz: z.string().optional().default('UTC'),
  })
  .refine((data) => new Date(data.from) <= new Date(data.to), {
    message: 'תאריך התחלה חייב להיות לפני או שווה לתאריך הסיום',
    path: ['from'],
  });

// Analytics query parameters validation
export const analyticsQuerySchema = z
  .object({
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך התחלה חייב להיות בפורמט YYYY-MM-DD')
      .refine((date) => !isNaN(Date.parse(date)), 'תאריך התחלה לא תקין'),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך סיום חייב להיות בפורמט YYYY-MM-DD')
      .refine((date) => !isNaN(Date.parse(date)), 'תאריך סיום לא תקין'),
    tz: z.string().optional().default('UTC'),
  })
  .refine((data) => new Date(data.from) <= new Date(data.to), {
    message: 'תאריך התחלה חייב להיות לפני או שווה לתאריך הסיום',
    path: ['from'],
  });

export type DashboardDetailsQuery = z.infer<typeof dashboardDetailsQuerySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
