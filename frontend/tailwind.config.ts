import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563eb', foreground: '#ffffff' },
        secondary: '#f1f5f9',
        border: '#e2e8f0',
      },
    },
  },
  plugins: [],
} satisfies Config;