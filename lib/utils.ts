import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Extend tailwind-merge to understand shadcn/ui design-token classes (e.g. bg-primary)
// so conflicts like "bg-primary bg-gray-900" reliably collapse to the last class.
const twMerge = extendTailwindMerge<string, string>({
  extend: {
    classGroups: {
      // shadcn/ui tokens
      'bg-color': [
        {
          bg: [
            'background',
            'foreground',
            'primary',
            'primary-foreground',
            'secondary',
            'secondary-foreground',
            'accent',
            'accent-foreground',
            'muted',
            'muted-foreground',
            'destructive',
            'destructive-foreground',
            'popover',
            'popover-foreground',
            'card',
            'card-foreground',
          ],
        },
      ],
      'text-color': [
        {
          text: [
            'background',
            'foreground',
            'primary',
            'primary-foreground',
            'secondary',
            'secondary-foreground',
            'accent',
            'accent-foreground',
            'muted',
            'muted-foreground',
            'destructive',
            'destructive-foreground',
            'popover',
            'popover-foreground',
            'card',
            'card-foreground',
          ],
        },
      ],
      'border-color': [
        {
          border: [
            'border',
            'input',
            'ring',
            'primary',
            'secondary',
            'accent',
            'destructive',
          ],
        },
      ],
      'ring-color': [
        {
          ring: ['ring', 'primary', 'secondary', 'accent', 'destructive'],
        },
      ],
      'ring-offset-color': [
        {
          'ring-offset': ['background'],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function (...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
