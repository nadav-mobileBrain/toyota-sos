'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminHome() {
  const router = useRouter();

  useEffect(() => {
    // Redirect admin home to tasks board
    router.replace('/admin/tasks');
  }, [router]);

  return null;
}
