/** @type {import('tailwindcss').Config} */
const token = name => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas:   token('canvas'),
        surface:  token('surface'),
        subtle:   token('subtle'),
        line:     token('line'),
        ink:      { DEFAULT: token('ink'), 2: token('ink-2'), 3: token('ink-3') },
        brand:    { DEFAULT: token('brand'), hover: token('brand-hover') },
        accent:   token('accent'),
        negative: token('negative'),
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
    },
  },
  plugins: [],
};
