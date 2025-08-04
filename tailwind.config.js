/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'workflow-bg': '#f8fafc',
        'tool-inout': '#10b981',
        'tool-preparation': '#3b82f6',
        'tool-join': '#8b5cf6',
        'tool-aggregate': '#f97316',
        mystic: {
          900: '#1a0b2e',
          800: '#2d1b42',
          700: '#4c2a6b',
          600: '#6b3fa0',
          500: '#8b5cf6',
          400: '#a78bfa',
          300: '#c4b5fd',
          200: '#ddd6fe',
          100: '#f3f0ff'
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
