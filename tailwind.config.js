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
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
