import type { AdvisorColor } from '@/types/task';

/**
 * Get all available advisor color options
 */
export function getAdvisorColorOptions(): AdvisorColor[] {
  return ['צהוב', 'ירוק', 'כתום', 'סגול בהיר'];
}

/**
 * Get Tailwind CSS classes for advisor color badge background
 */
export function getAdvisorColorBgClass(color: AdvisorColor | null | undefined): string {
  if (!color) return '';
  
  const colorMap: Record<AdvisorColor, string> = {
    'צהוב': 'bg-yellow-400',
    'ירוק': 'bg-green-500',
    'כתום': 'bg-orange-500',
    'סגול בהיר': 'bg-purple-500',
  };
  
  return colorMap[color] || '';
}

/**
 * Get Tailwind CSS classes for advisor color text
 */
export function getAdvisorColorTextClass(color: AdvisorColor | null | undefined): string {
  if (!color) return '';
  
  // Always use white text for better contrast on colored backgrounds
  return 'text-white';
}

/**
 * Get hex color code for advisor color
 */
export function getAdvisorColorHex(color: AdvisorColor | null | undefined): string {
  if (!color) return '';
  
  const colorMap: Record<AdvisorColor, string> = {
    'צהוב': '#FFD700',
    'ירוק': '#10B981',
    'כתום': '#F97316',
    'סגול בהיר': '#A855F7',
  };
  
  return colorMap[color] || '';
}

/**
 * Get inline style object for advisor color background
 */
export function getAdvisorColorStyle(color: AdvisorColor | null | undefined): React.CSSProperties {
  if (!color) return {};
  
  return {
    backgroundColor: getAdvisorColorHex(color),
  };
}

