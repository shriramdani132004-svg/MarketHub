import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#172554',
        indigo: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        violet: { 500: '#7C3AED', 600: '#6D28D9' },
        teal: { 50: '#E6FFFA', 500: '#14B8A6', 600: '#0D9488', 700: '#0F766E' },
        sky: { 500: '#0284C7', 600: '#0369A1' },
        orange: { 50: '#FFF3E8', 500: '#F97316', 600: '#EA580C' },
        amber: { 500: '#F59E0B', 600: '#D97706' },
        page: '#F6F7FC',
        ink: '#111827',
        muted: '#667085',
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans Variable"',
          'Plus Jakarta Sans',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16, 24, 40, 0.04), 0 8px 24px -12px rgba(23, 37, 84, 0.16)',
        lift: '0 18px 45px -20px rgba(23, 37, 84, 0.35)',
        ring: '0 0 0 4px rgba(79, 70, 229, 0.14)',
      },
      borderRadius: {
        xl2: '1.15rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
