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

  if (taskType === 'איסוף רכב/שינוע פרטי') {
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

  if (taskType === 'איסוף רכב/שינוע+טסט') {
    return [
      {
        id: 'has_order',
        type: 'boolean',
        title: 'האם יש לך הזמנה?',
        required: true,
      },
    ];
  }

  if (taskType === 'איסוף רכב/שינוע+טסט מוביליטי') {
    return [
      {
        id: 'new_vehicle_license',
        type: 'boolean',
        title: 'האם יש לך רשיון רכב חדש?',
        required: true,
      },
      {
        id: 'has_insurance',
        type: 'boolean',
        title: 'האם יש ביטוח?',
        required: true,
      },
      {
        id: 'union_power_of_attorney',
        type: 'boolean',
        title: 'האם יש יפוי כוח יוניון?',
        required: true,
      },
    ];
  }

  if (taskType === 'החזרת רכב/שינוע פרטי') {
    return [
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
      {
        id: 'vehicle_clean',
        type: 'boolean',
        title: 'האם הרכב שטוף ונקי?',
        required: true,
      },
    ];
  }

  if (taskType === 'החזרת רכב מוביליטי') {
    return [
      {
        id: 'mobility_maintenance_form',
        type: 'boolean',
        title: 'האם יש טופס תקינות מוביליטי(אישור טיפול)?',
        required: true,
      },
    ];
  }

  if (taskType === 'מסירת רכב חלופי') {
    return [
      {
        id: 'signed_at_desk',
        type: 'boolean',
        title: 'האם חתמת על הרכב בדלפק?',
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
  if (taskType === 'איסוף רכב/שינוע פרטי') {
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

  if (taskType === 'איסוף רכב/שינוע+טסט') {
    return [
      {
        id: 'new_vehicle_license_paid',
        type: 'boolean',
        title: 'האם יש רשיון רכב חדש משולם?',
        required: true,
      },
      {
        id: 'vehicle_photo_nesher_km',
        type: 'boolean',
        title: 'האם יש צילום הרכב בנשר(כולל ק״מ)?',
        required: true,
      },
      {
        id: 'client_id_card',
        type: 'boolean',
        title: 'האם יש תעודת זהות של הלקוח?',
        required: true,
      },
    ];
  }

  if (taskType === 'מסירת רכב חלופי') {
    // Pre-step before the 3-step ReplacementCarDeliveryForm
    return [
      {
        id: 'delivery_form',
        type: 'boolean',
        title: 'האם יש טופס מסירת רכב?',
        required: true,
      },
    ];
  }

  if (taskType === 'ביצוע טסט') {
    // Pre-step before the TestCompletionPopup
    return [
      {
        id: 'signed_test_form',
        type: 'boolean',
        title: 'האם יש טופס טסט חתום?',
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
):
  | 'replacement_car_delivery'
  | 'test_completion'
  | 'mobility_test_completion'
  | null {
  if (taskType === 'מסירת רכב חלופי') {
    return 'replacement_car_delivery';
  }
  if (taskType === 'ביצוע טסט') {
    return 'test_completion';
  }
  if (taskType === 'איסוף רכב/שינוע+טסט מוביליטי') {
    return 'mobility_test_completion';
  }
  return null;
}
