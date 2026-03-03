/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          primary: '#FFFFFF',
          secondary: '#F9FAFB',
          tertiary: '#F3F4F6',
          elevated: '#FFFFFF',
        },
        border: {
          DEFAULT: '#E5E7EB',
          secondary: '#D1D5DB',
        },
        content: {
          primary: '#111827',
          secondary: '#4B5563',
          tertiary: '#9CA3AF',
          quaternary: '#D1D5DB',
        },
        accent: {
          DEFAULT: '#E8432A',
          hover: '#D63B23',
          active: '#C4331D',
          muted: 'rgba(232, 67, 42, 0.10)',
          subtle: 'rgba(232, 67, 42, 0.05)',
        },
        success: {
          DEFAULT: '#16A34A',
          muted: 'rgba(22, 163, 74, 0.10)',
        },
        warning: {
          DEFAULT: '#D97706',
          muted: 'rgba(217, 119, 6, 0.10)',
        },
        error: {
          DEFAULT: '#DC2626',
          muted: 'rgba(220, 38, 38, 0.10)',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.05)',
        'medium': '0 4px 16px rgba(0, 0, 0, 0.07)',
      },
    },
  },
  plugins: [],
};
