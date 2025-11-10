'use client';

import { TaskCard } from '@/components/driver/TaskCard';

export default function DriverHome() {
  return (
    <main dir="rtl" className="min-h-screen p-4 space-y-4">
      <TaskCard
        id="t1"
        title="מסירת רכב ללקוח"
        type="pickup_or_dropoff_car"
        priority="high"
        status="pending"
        estimatedStart={new Date(Date.now() - 60 * 60 * 1000)}
        estimatedEnd={new Date(Date.now() + 30 * 60 * 1000)}
        address="תל אביב, דיזנגוף 100"
        clientName="לקוח א"
        vehicle={{ licensePlate: '12-345-67', model: 'Corolla' }}
      />
      <TaskCard
        id="t2"
        title="הסעת לקוח למוסך"
        type="drive_client_to_dealership"
        priority="medium"
        status="in_progress"
        estimatedStart={new Date(Date.now() - 30 * 60 * 1000)}
        estimatedEnd={new Date(Date.now() + 60 * 60 * 1000)}
        address="חולון, רחוב הראשונים 5"
        clientName="לקוח ב"
        vehicle={{ licensePlate: '89-012-34', model: 'Yaris' }}
      />
    </main>
  );
}

