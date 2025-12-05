import dayjs from '@/lib/dayjs';
import type { DateRange } from './queries';

/**
 * Calculate the equivalent previous period for trend comparison
 *
 * @param currentRange The current period
 * @returns The equivalent previous period for comparison
 */
export function calculatePreviousPeriod(currentRange: DateRange): DateRange {
  const start = dayjs(currentRange.start);
  const end = dayjs(currentRange.end);

  // Calculate the duration in milliseconds
  const durationMs = end.valueOf() - start.valueOf();

  // Calculate previous period by subtracting the duration from start
  const prevStart = start.subtract(durationMs, 'milliseconds');
  const prevEnd = start; // Previous period ends where current period starts

  return {
    start: prevStart.toISOString(),
    end: prevEnd.toISOString(),
    timezone: currentRange.timezone,
  };
}

/**
 * Calculate percentage change between current and previous values
 *
 * @param current Current period value
 * @param previous Previous period value
 * @returns Percentage change (can be positive, negative, or zero)
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    // If previous is 0 and current > 0, consider it 100% increase
    // If both are 0, consider it no change
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Format percentage change with proper sign and formatting
 *
 * @param percentageChange The percentage change value
 * @returns Formatted string like "+12.5%" or "-8.3%" or "0%"
 */
export function formatPercentageChange(percentageChange: number): string {
  if (percentageChange === 0) return '0%';

  const sign = percentageChange > 0 ? '+' : '';
  return `${sign}${percentageChange}%`;
}

/**
 * Determine trend direction based on percentage change
 *
 * @param percentageChange The percentage change value
 * @returns Trend direction: 'up', 'down', or 'neutral'
 */
export function getTrendDirection(percentageChange: number): 'up' | 'down' | 'neutral' {
  if (percentageChange > 0) return 'up';
  if (percentageChange < 0) return 'down';
  return 'neutral';
}

/**
 * Get trend color class based on direction and context
 *
 * @param direction Trend direction
 * @param isPositiveGood Whether positive trends are good (default: true)
 * @returns Tailwind color class
 */
export function getTrendColorClass(
  direction: 'up' | 'down' | 'neutral',
  isPositiveGood: boolean = true
): string {
  if (direction === 'neutral') return 'text-slate-500';

  if (isPositiveGood) {
    return direction === 'up' ? 'text-green-600' : 'text-red-600';
  } else {
    // For metrics where increase is bad (like late tasks)
    return direction === 'up' ? 'text-red-600' : 'text-green-600';
  }
}

/**
 * Get trend background color class based on direction and context
 *
 * @param direction Trend direction
 * @param isPositiveGood Whether positive trends are good (default: true)
 * @returns Tailwind background color class
 */
export function getTrendBgColorClass(
  direction: 'up' | 'down' | 'neutral',
  isPositiveGood: boolean = true
): string {
  if (direction === 'neutral') return 'bg-slate-100';

  if (isPositiveGood) {
    return direction === 'up' ? 'bg-green-100' : 'bg-red-100';
  } else {
    // For metrics where increase is bad (like late tasks)
    return direction === 'up' ? 'bg-red-100' : 'bg-green-100';
  }
}