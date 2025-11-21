'use client';

import React from 'react';
import { NotificationsList } from '@/components/notifications/NotificationsList';

export default function DriverNotificationsPage() {
  return (
    <main className="min-h-[60vh] p-4">
      <div className="mb-4">
        <h2 className="text-xl font-bold">התראות</h2>
      </div>
      <NotificationsList />
    </main>
  );
}
