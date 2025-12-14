import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { notify } from '@/lib/notify';

export async function GET(request: NextRequest) {
  // 1. Verify Cron Secret to prevent unauthorized execution
  const authHeader = request.headers.get('authorization');
  const url = new URL(request.url);
  const queryKey = url.searchParams.get('key');

  if (
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    queryKey !== process.env.CRON_SECRET
  ) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // 2. Query Tasks matching criteria:
  // - Type: 'drive_client_home' / 'drive_client_to_dealership' (Hebrew: 'הסעת לקוח הביתה', 'הסעת לקוח למוסך')
  // - Status: 'pending' (Hebrew: 'בהמתנה')
  // - Estimated Start: Over 5 minutes ago
  // - Assigned: Has at least one driver (checked via inner join on task_assignees)
  // - Notified: admin_notified_late_start is false

  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  const { data: tasks, error } = await admin
    .from('tasks')
    .select(
      `
      id,
      title,
      type,
      estimated_start,
      task_assignees!inner (
        profiles (
          name
        )
      )
    `
    )
    .in('type', ['הסעת לקוח הביתה', 'הסעת לקוח למוסך'])
    .eq('status', 'בהמתנה')
    .lt('estimated_start', fiveMinutesAgo)
    .eq('admin_notified_late_start', false);

  if (error) {
    console.error('Error fetching late tasks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  // 3. Fetch Admins and Managers to notify
  const { data: recipients, error: profilesError } = await admin
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'manager']);

  if (profilesError) {
    console.error('Error fetching admins:', profilesError);
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  if (!recipients || recipients.length === 0) {
    console.warn('No admins/managers found to notify');
    return NextResponse.json({
      ok: true,
      count: tasks.length,
      notified: 0,
      warning: 'No recipients found',
    });
  }

  const recipientList = recipients.map((r) => ({ user_id: r.id }));

  // 4. Send Notifications and Update Tasks
  let notifiedCount = 0;

  await Promise.all(
    tasks.map(async (task: any) => {
      try {
        // Extract driver names for the message
        const drivers =
          task.task_assignees
            ?.map((ta: any) => ta.profiles?.name)
            .filter(Boolean)
            .join(', ') || 'ללא שם';

        const taskTitle = task.title || 'ללא כותרת';

        // Send Push Notification
        await notify({
          type: 'late_start_alert',
          task_id: task.id,
          recipients: recipientList,
          payload: {
            title: 'התראה על איחור במשימה',
            body: `המשימה "${taskTitle}" (נהג: ${drivers}) לא התחילה בזמן (איחור של 5 דקות).`,
            url: `/admin/dashboard?taskId=${task.id}`, // Deep link to task in dashboard
            priority: 'high',
            taskId: task.id,
          },
        });

        // Update DB flag to prevent duplicate alerts
        const { error: updateError } = await admin
          .from('tasks')
          .update({ admin_notified_late_start: true })
          .eq('id', task.id);

        if (updateError) {
          console.error(
            `Failed to update task ${task.id} notified flag:`,
            updateError
          );
        } else {
          notifiedCount++;
        }
      } catch (err) {
        console.error(`Failed to process task ${task.id}:`, err);
      }
    })
  );

  return NextResponse.json({
    ok: true,
    count: tasks.length,
    notified: notifiedCount,
  });
}
