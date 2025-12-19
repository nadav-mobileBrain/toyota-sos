'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function AppLogo() {
  const pathname = usePathname();
  const isDriverPage = pathname?.startsWith('/driver');
  const isAdminPage = pathname?.startsWith('/admin');

  return (
    <div
      className={cn(
        'z-50 transition-all duration-300',
        isDriverPage 
          ? 'absolute top-2 right-2' 
          : isAdminPage
            ? 'absolute top-3 right-3 md:top-4 md:right-4'
            : 'absolute top-4 right-4'
      )}
    >
      <Image
        src="/icons/icon-fresh-192.jpg"
        alt="Toyota SOS"
        width={100}
        height={100}
        className={cn(
          'shadow-md bg-white/90 backdrop-blur-sm border border-red-200 transition-all',
          isDriverPage
            ? 'rounded-lg w-14 h-14'
            : isAdminPage
              ? 'rounded-xl w-14 h-14 md:w-20 md:h-20'
              : 'rounded-2xl w-32 h-32 md:w-40 md:h-40'
        )}
        priority
      />
    </div>
  );
}

