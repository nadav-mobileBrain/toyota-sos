'use client';

import React from 'react';

export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', reg);
      } catch (err) {
        console.error('Service Worker registration failed:', err);
      }
    };

    // Register immediately
    register();
  }, []);

  return null;
}


