/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ngx:   { DEFAULT: '#007B3E', light: '#009B4E', dark: '#005a2d' },
        gold:  { DEFAULT: '#C49A00', light: '#FFD700' },
        navy:  '#0A1628',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
