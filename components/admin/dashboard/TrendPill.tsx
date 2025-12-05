'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrendData } from '@/lib/dashboard/queries';

interface TrendPillProps {
  trend: TrendData;
  /** Whether positive trends should be shown as good (green) or bad (red). Default: true */
  isPositiveGood?: boolean;
  /** Size variant of the pill */
  size?: 'sm' | 'md';
  /** Additional class names */
  className?: string;
}

export function TrendPill({
  trend,
  isPositiveGood = true,
  size = 'sm',
  className
}: TrendPillProps) {
  const { percentageChange, direction } = trend;

  // If no change, show neutral state
  if (direction === 'neutral') {
    return (
      <div className={cn(
        'inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-500',
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        className
      )}>
        <Minus className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
        <span className="font-medium">0%</span>
      </div>
    );
  }

  // Determine colors based on direction and context
  const isGoodTrend = isPositiveGood ? direction === 'up' : direction === 'down';

  const colorClasses = isGoodTrend
    ? 'bg-green-100 text-green-700'
    : 'bg-red-100 text-red-700';

  // Choose the appropriate icon
  const Icon = direction === 'up' ? TrendingUp : TrendingDown;

  // Format percentage with proper sign
  const formattedPercentage = percentageChange > 0
    ? `+${percentageChange}%`
    : `${percentageChange}%`;

  return (
    <div className={cn(
      'inline-flex items-center gap-1 rounded-full',
      colorClasses,
      size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
      className
    )}>
      <Icon className={cn(size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
      <span className="font-medium">{formattedPercentage}</span>
    </div>
  );
}

interface TrendPillWithLabelProps extends TrendPillProps {
  /** Label to show before the trend pill */
  label?: string;
  /** Whether to show the label */
  showLabel?: boolean;
}

/**
 * TrendPill with an optional label for better context
 */
export function TrendPillWithLabel({
  label,
  showLabel = true,
  ...trendPillProps
}: TrendPillWithLabelProps) {
  if (!showLabel || !label) {
    return <TrendPill {...trendPillProps} />;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <TrendPill {...trendPillProps} />
    </div>
  );
}