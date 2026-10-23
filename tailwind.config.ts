import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: '#FBF6EC', 50: '#FEFCF8', 100: '#FBF6EC', 200: '#F3EAD6', 300: '#E8DBBE' },
        burgundy: { DEFAULT: '#7A1F3D', 50: '#FBEFF3', 100: '#F4D5DF', 500: '#7A1F3D', 600: '#671833', 700: '#531329' },
        emerald: { DEFAULT: '#0F7B5F', 50: '#E8F6F1', 100: '#C7E8DD', 500: '#0F7B5F', 600: '#0C664F', 700: '#094F3D' },
        gold: { DEFAULT: '#C9962B', 50: '#FBF4E1', 100: '#F3E2B3', 500: '#C9962B', 600: '#A97A1B' },
        coral: { DEFAULT: '#E8735A', 50: '#FDEEEA', 100: '#F9D3CA', 500: '#E8735A', 600: '#CF5A41' },
        charcoal: { DEFAULT: '#2B2523', 500: '#2B2523', 400: '#4A4240', 300: '#6F6663', 200: '#9C938F', 100: '#D9D2CC' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(43,37,35,0.05), 0 8px 24px -12px rgba(43,37,35,0.12)',
      },
    },
  },
  plugins: [],
};
export default config;
