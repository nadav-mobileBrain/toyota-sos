'use client';

import React from 'react';

export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    const controller = new AbortController();
    const register = async () => {
      try {
        // Register the core SW; scope defaults to '/'
        await navigator.serviceWorker.register('/sw.js', { scope: '/', type: 'classic' });
      } catch {
        // ignore registration failures in dev/test
      }
    };
    // Defer a tick to avoid blocking first paint
    const t = setTimeout(register, 0);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, []);
  return null;
}


