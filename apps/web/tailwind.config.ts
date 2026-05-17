import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Space identity — placeholders, refine in design pass.
        knowverse: {
          DEFAULT: '#0a0e27',
          deep: '#05071a',
          star: '#e7e9ff',
        },
      },
    },
  },
  plugins: [],
};

export default config;
