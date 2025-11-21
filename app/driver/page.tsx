'use client';

import { DriverHome as DriverHomeList } from '@/components/driver/DriverHome';
import { Suspense } from 'react';

export default function DriverHome() {
  return (
    <main dir="rtl" className="min-h-screen p-4 space-y-4">
      <Suspense fallback={null}>
        <DriverHomeList />
      </Suspense>
    </main>
  );
}
