'use client';

import React from 'react';
import dayjs from '@/lib/dayjs';

export type Iso = string;
export interface PeriodRange {
  start: Iso;
  end: Iso;
  timezone?: string;
}

interface PeriodContextValue {
  range: PeriodRange;
  setRange: (r: PeriodRange) => void;
}

const defaultRange: PeriodRange = (() => {
  const now = dayjs();
  const start = now.startOf('day');
  const end = now.endOf('day');
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    timezone: 'UTC',
  };
})();

const PeriodContext = React.createContext<PeriodContextValue>({
  range: defaultRange,
  setRange: () => {},
});

export function usePeriod() {
  return React.useContext(PeriodContext);
}

export function PeriodProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: PeriodRange;
}) {
  const [range, setRange] = React.useState<PeriodRange>(
    initial || defaultRange
  );

  // rehydrate from URL/localStorage on mount
  React.useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      if (from && to) {
        setRange({
          start: dayjs(from).toISOString(),
          end: dayjs(to).toISOString(),
          timezone: 'UTC',
        });
        return;
      }
      const stored = window.localStorage.getItem('dashboard.period');
      if (stored) {
        const parsed = JSON.parse(stored) as PeriodRange;
        if (parsed?.start && parsed?.end) setRange(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // persist on change
  React.useEffect(() => {
    try {
      window.localStorage.setItem('dashboard.period', JSON.stringify(range));
      const url = new URL(window.location.href);
      url.searchParams.set('from', range.start);
      url.searchParams.set('to', range.end);
      window.history.replaceState(
        null,
        '',
        `${url.pathname}?${url.searchParams.toString()}`
      );
    } catch {
      // no-op
    }
  }, [range]);

  return (
    <PeriodContext.Provider value={{ range, setRange }}>
      {children}
    </PeriodContext.Provider>
  );
}
