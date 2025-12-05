import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'toyota-red': 'hsl(var(--toyota-red))',
        'toyota-blue': 'hsl(var(--toyota-blue))',
        'toyota-gray': 'hsl(var(--toyota-gray))',
        'toyota-silver': 'hsl(var(--toyota-silver))',
        'toyota-gold': 'hsl(var(--toyota-gold))',
        primary: 'hsl(var(--primary))',
        secondary: 'hsl(var(--secondary))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        serif: 'var(--font-serif)',
        mono: 'var(--font-mono)',
      },
    },
  },
  darkMode: ['class', 'class'],
};

export default config;
