import type { ChecklistSchema } from '@/components/driver/ChecklistModal';

/**
 * Return the checklist schema a driver must complete when moving a task
 * into a given status (currently only "start work" for specific task types).
 *
 * NOTE:
 * - Task types here are the DB enum values (e.g. 'licence_test'), not the
 *   Hebrew labels used in the admin UI.
 */

export function getStartChecklistForTaskType(
  taskType: string | null | undefined
): ChecklistSchema | null {
  // The DB stores the Hebrew label for task types (e.g. "ביצוע טסט")
  if (taskType === 'ביצוע טסט') {
    // "ביצוע טסט" start checklist
    return [
      {
        id: 'test_invitation',
        type: 'boolean',
        title: 'האם לקחת הזמנה של הטסט?',
        required: true,
      },
      {
        id: 'car_license',
        type: 'boolean',
        title: 'האם לקחת רשיון רכב?',
        required: true,
      },
      {
        id: 'client_id',
        type: 'boolean',
        title: 'האם לקחת ת.ז לקוח? - אם יש 2 בעלים חובה 2 ת.ז',
        required: true,
      },
      {
        id: 'client_power_of_attorney',
        type: 'boolean',
        title: 'האם לקחת יפוי כוח של הלקוח?',
        required: true,
      },
      {
        id: 'vehicle_insurance',
        type: 'boolean',
        title: 'האם לקחת ביטוח חובה של הרכב?',
        required: true,
      },
    ];
  }

  if (taskType === 'איסוף רכב/שינוע') {
    // Phase 1: When moving from 'בהמתנה' to 'בעבודה'
    return [
      {
        id: 'client_quote',
        type: 'boolean',
        title: 'האם יש הצעת מחיר מהלקוח?',
        required: true,
      },
      {
        id: 'transport_form',
        type: 'boolean',
        title: 'האם יש טופס שינוע מהמערכת?',
        required: true,
      },
    ];
  }

  if (taskType === 'החזרת רכב/שינוע') {
    return [
      {
        id: 'mobility_approval',
        type: 'boolean',
        title: 'אישור תקינות - לרכבי מוביליטי',
        required: true,
      },
      {
        id: 'invoice',
        type: 'boolean',
        title: 'האם יש חשבונית?',
        required: true,
      },
      {
        id: 'postcard_gift',
        type: 'boolean',
        title: 'האם יש גלויה ומתנה?',
        required: true,
      },
    ];
  }

  return null;
}

/**
 * Return the checklist schema a driver must complete when moving a task
 * to 'הושלמה' status for specific task types.
 */
export function getCompletionChecklistForTaskType(
  taskType: string | null | undefined
): ChecklistSchema | null {
  if (taskType === 'איסוף רכב/שינוע') {
    // Phase 2: When moving from 'בעבודה' to 'הושלמה'
    return [
      {
        id: 'signed_quote',
        type: 'boolean',
        title: 'האם יש הצעת מחיר חתומה ע״י הלקוח?',
        required: true,
      },
      {
        id: 'vehicle_insurance',
        type: 'boolean',
        title: 'האם יש ביטוח לרכב?',
        required: true,
      },
      {
        id: 'vehicle_photo_nesher',
        type: 'boolean',
        title: 'האם יש צילום רכב בנשר?',
        required: true,
      },
    ];
  }

  return null;
}

/**
 * Determines which special completion flow (if any) is required for a task type
 * when moving to 'completed' status.
 */
export function getCompletionFlowForTaskType(
  taskType: string | null | undefined
): 'replacement_car_delivery' | 'test_completion' | null {
  if (taskType === 'הסעת רכב חלופי') {
    return 'replacement_car_delivery';
  }
  if (taskType === 'ביצוע טסט') {
    return 'test_completion';
  }
  return null;
}
