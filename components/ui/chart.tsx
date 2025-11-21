'use client';

import * as React from 'react';
import type { TooltipProps } from 'recharts';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<
  string,
  {
    label: string;
    color: string;
  }
>;

const ChartContext = React.createContext<{ config: ChartConfig }>({
  config: {},
});

export function ChartContainer({
  children,
  config,
  className,
}: {
  children: React.ReactNode;
  config: ChartConfig;
  className?: string;
}) {
  return (
    <ChartContext.Provider value={{ config }}>
      <div className={cn('h-full w-full', className)}>{children}</div>
    </ChartContext.Provider>
  );
}

export function useChartConfig() {
  return React.useContext(ChartContext);
}

export function ChartTooltipContent({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  const { config } = useChartConfig();
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      {label && (
        <div className="mb-1 font-semibold text-gray-900">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry) => {
          if (!entry || typeof entry.value !== 'number') return null;
          const key = entry.dataKey?.toString() || '';
          const conf = config[key];
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: conf?.color || entry.color }}
                />
                <span className="text-gray-700">
                  {conf?.label || key}
                </span>
              </span>
              <span className="font-mono text-gray-900">
                {entry.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


