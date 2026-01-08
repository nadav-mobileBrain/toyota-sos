import React from 'react';
import { AdminNotificationBell } from '@/components/admin/AdminNotificationBell';
import { APP_VERSION } from '@/lib/appVersion';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Non-sticky top bar for bell and logo space */}
      <div className="w-full flex justify-between items-center px-4 py-3 relative z-60">
        {/* Spacer for the absolute logo (Logo is top-3 right-3) */}
        <div className="w-14 h-14 md:w-20 md:h-20" />
        <AdminNotificationBell />
      </div>
      <div className="flex-1">
        {children}
      </div>
      <footer className="w-full border-t border-slate-200 bg-white/80 px-4 py-2 text-center text-xs text-slate-500">
        גרסה {APP_VERSION}
      </footer>
    </div>
  );
}

