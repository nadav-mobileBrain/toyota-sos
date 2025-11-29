import React from 'react';
import { AdminSignOutButton } from '@/components/admin/AdminSignOutButton';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminSignOutButton />
      {children}
    </>
  );
}

