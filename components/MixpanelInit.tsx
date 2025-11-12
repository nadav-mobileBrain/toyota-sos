'use client';

import React from 'react';
import mixpanel from 'mixpanel-browser';

export function MixpanelInit() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    // Prevent double init on Fast Refresh
    if ((window as any).__mixpanel_inited) return;
    const token =
      process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || 'dbe6cb24df9f2ad1c563a71acd174b9e';
    mixpanel.init(token, {
      track_pageview: true,
      persistence: 'localStorage',
      autocapture: true,
      record_sessions_percent: 100,
      debug: false,
    });
    (window as any).__mixpanel_inited = true;
  }, []);
  return null;
}


