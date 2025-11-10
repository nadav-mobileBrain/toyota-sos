'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: '/driver', label: 'משימות' }, // Tasks
    { href: '/driver/notifications', label: 'התראות' }, // Notifications
    { href: '/driver/profile', label: 'פרופיל' }, // Profile
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-white">
      {/* Content */}
      <div className="max-w-xl mx-auto w-full px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+72px)]">
        {children}
      </div>

      {/* Bottom navigation (sticky) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 bg-white/95 border-t border-gray-200 backdrop-blur supports-backdrop-filter:bg-white/80 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-xl mx-auto grid grid-cols-3 gap-1 p-2 h-16">
          {tabs.map((t) => {
            // Only mark '/driver' as active on exact match.
            // Other tabs are active on exact or nested paths.
            const active =
              t.href === '/driver'
                ? pathname === '/driver'
                : pathname === t.href || pathname.startsWith(t.href + '/');
            return (
              <Link
                key={t.href}
                href={t.href}
                className={[
                  'flex items-center justify-center rounded-md text-sm font-medium transition-colors duration-150 select-none min-h-[44px]',
                  active
                    ? 'bg-toyota-primary text-white ring-1 ring-toyota-primary shadow-inner'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
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
