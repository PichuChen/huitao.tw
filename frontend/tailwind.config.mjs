/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F5F0E8',
          100: '#D4C5B8',
          200: '#C4A882',
          300: '#8FA99C',
          400: '#8B6F5E',
          500: '#2C1F14',
          600: '#23180f',
          700: '#1b130b',
          800: '#150f08',
          900: '#0f0a06',
        },
        accent: {
          sand: '#C4A882',
          clay: '#8B6F5E',
          mist: '#D4C5B8',
          celadon: '#8FA99C',
          ink: '#2C1F14',
          rice: '#F5F0E8',
        }
      }
    },
  },
  plugins: [],
}