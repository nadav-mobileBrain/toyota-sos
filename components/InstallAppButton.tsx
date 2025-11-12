'use client';

import React from 'react';

export function InstallAppButton({ className }: { className?: string }) {
  const [deferred, setDeferred] = React.useState<any>(null);
  const [installed, setInstalled] = React.useState(false);
  const [supportsPrompt, setSupportsPrompt] = React.useState(false);
  const [isIOS, setIsIOS] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) && !!(window as any).webkit);
    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setSupportsPrompt(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setSupportsPrompt(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt as any);
    window.addEventListener('appinstalled', onInstalled as any);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt as any);
      window.removeEventListener('appinstalled', onInstalled as any);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setSupportsPrompt(false);
  };

  if (installed) return null;

  // iOS Safari: no programmatic prompt
  if (isIOS) {
    return (
      <div className={`text-xs text-gray-600 ${className ?? ''}`}>
        להוספה למסך הבית: שתף → הוסף למסך הבית
      </div>
    );
  }

  if (!supportsPrompt) return null;

  return (
    <button
      onClick={install}
      className={
        className ??
        'rounded bg-toyota-primary px-3 py-2 text-sm font-semibold text-white hover:bg-toyota-primary/90'
      }
    >
      התקן אפליקציה
    </button>
  );
}


