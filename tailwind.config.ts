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
        'toyota-primary': '#d60b25',
        'toyota-secondary-black': '#000000',
        'toyota-secondary-white': '#ffffff',
      },
    },
  },
  darkMode: ['class', 'class'],
};

export default config;
