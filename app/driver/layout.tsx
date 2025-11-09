'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tabs = [
    { href: '/driver', label: 'משימות' }, // Tasks
    { href: '/driver/notifications', label: 'התראות' }, // Notifications
    { href: '/driver/profile', label: 'פרופיל' }, // Profile
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-white pb-[72px]">
      <div className="max-w-xl mx-auto px-4 py-4">{children}</div>

      {/* Bottom navigation (sticky) */}
      <nav
        className="fixed inset-x-0 bottom-0 bg-white/95 border-t border-gray-200 backdrop-blur supports-[backdrop-filter]:bg-white/80"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-xl mx-auto grid grid-cols-3 gap-1 p-2">
          {tabs.map((t) => {
            const active =
              pathname === t.href || pathname.startsWith(t.href + '/');
            return (
              <Link
                key={t.href}
                href={t.href}
                className={[
                  'text-center rounded-md py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-toyota-primary text-white ring-1 ring-toyota-primary'
                    : 'text-gray-700 hover:bg-gray-100',
                ].join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}


