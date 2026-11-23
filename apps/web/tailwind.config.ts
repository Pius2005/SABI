import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Atkinson Hyperlegible', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      minHeight: {
        touch: '3.5rem',
        touchLg: '4.5rem',
      },
      maxWidth: {
        reading: '42rem',
      },
      boxShadow: {
        hard: '0.35rem 0.35rem 0 rgb(var(--ink))',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.96)', opacity: '0.9' },
          '70%': { transform: 'scale(1.08)', opacity: '0.35' },
          '100%': { transform: 'scale(1.12)', opacity: '0' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
