'use client';

import { useEffect, useMemo, useState } from 'react';
import { getFlags, isEnabled as flagsIsEnabled, subscribe } from './flags';

export function useFeatureFlag(key: string) {
  const [value, setValue] = useState<boolean>(() => flagsIsEnabled(key));
  const stableKey = useMemo(() => key, [key]);

  useEffect(() => {
    let mounted = true;
    // Ensure flags are loaded at least once
    getFlags().catch(() => {});
    const unsub = subscribe((snapshot) => {
      if (!mounted) return;
      setValue(!!snapshot[stableKey]);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [stableKey]);

  return value;
}


