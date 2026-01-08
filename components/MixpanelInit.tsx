'use client';

import React from 'react';
import { initMixpanel, setSuperProperties } from '@/lib/mixpanel';
import { APP_VERSION } from '@/lib/appVersion';

export function MixpanelInit() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__mixpanel_inited) return;
    initMixpanel();
    setSuperProperties({ app_version: APP_VERSION, device_type: 'web' });
    (window as any).__mixpanel_inited = true;
  }, []);
  return null;
}


