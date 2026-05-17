/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
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
