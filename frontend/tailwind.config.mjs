/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7f3',
          100: '#e7ede2',
          200: '#cfddc7',
          300: '#adc49e',
          400: '#8ba777',
          500: '#6f8c5b',
          600: '#556d45',
          700: '#435637',
          800: '#36452d',
          900: '#2d3a27',
        }
      }
    },
  },
  plugins: [],
}