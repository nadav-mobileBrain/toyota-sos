'use client';

import mixpanel from 'mixpanel-browser';
import { getFlags } from './flags';

let inited = false;
const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
if (!token) {
  throw new Error('NEXT_PUBLIC_MIXPANEL_TOKEN is not set');
}

const hasConsent = () => {
  if (typeof window === 'undefined') return false;
  try {
    return (
      (localStorage.getItem('analytics:consent') || 'granted') === 'granted'
    );
  } catch {
    return true;
  }
};

export function initMixpanel() {
  if (inited || typeof window === 'undefined') return;
  mixpanel.init(token as string, {
    track_pageview: true,
    persistence: 'localStorage',
    autocapture: true,
    record_sessions_percent: 100,
    api_host: 'https://api-eu.mixpanel.com',
    debug: true,
  });
  inited = true;
  // Fire-and-forget: register feature flags and cohort variant as super properties
  try {
    (async () => {
      try {
        const flags = await getFlags().catch(() => ({}));
        const superProps: Record<string, any> = {};
        Object.entries(flags || {}).forEach(([k, v]) => {
          superProps[`flag.${k}`] = !!v;
        });
        if (Object.keys(superProps).length > 0) {
          mixpanel.register(superProps);
        }
        const variant = getOrAssignVariant();
        mixpanel.register({ 'cohort.variant': variant });
      } catch {
        // ignore
      }
    })();
  } catch {
    // ignore
  }
}

export function identify(userId: string, props?: Record<string, any>) {
  if (!hasConsent()) return;
  initMixpanel();
  mixpanel.identify(userId);
  if (props) mixpanel.people.set(props);
}

export function setSuperProperties(props: Record<string, any>) {
  if (!hasConsent()) return;
  initMixpanel();
  mixpanel.register(props);
}

export function track(event: string, props?: Record<string, any>) {
  if (!hasConsent()) return;
  initMixpanel();
  mixpanel.track(event, props || {});
}

export function reset() {
  try {
    mixpanel.reset();
  } catch {
    // ignore
  }
}

function getOrAssignVariant(): 'A' | 'B' {
  if (typeof window === 'undefined') return 'A';
  try {
    const key = 'ab_variant';
    const existing = localStorage.getItem(key);
    if (existing === 'A' || existing === 'B') return existing as 'A' | 'B';
    // Stable-ish assignment using userAgent hash fallback to random
    const ua = navigator.userAgent || `${Math.random()}`;
    let hash = 0;
    for (let i = 0; i < ua.length; i++) {
      hash = (hash << 5) - hash + ua.charCodeAt(i);
      hash |= 0;
    }
    const variant: 'A' | 'B' = Math.abs(hash) % 2 === 0 ? 'A' : 'B';
    localStorage.setItem(key, variant);
    return variant;
  } catch {
    return 'A';
  }
}
