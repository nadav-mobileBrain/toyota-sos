import { TaskDetails } from '@/components/driver/TaskDetails';

export default async function TaskDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main dir="rtl" className="min-h-screen p-4">
      <TaskDetails taskId={id} />
    </main>
  );
}


