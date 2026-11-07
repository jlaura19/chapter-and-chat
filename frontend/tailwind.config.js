/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        parchment: 'rgb(var(--c-parchment) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        sepia: 'rgb(var(--c-sepia) / <alpha-value>)',
        burgundy: 'rgb(var(--c-burgundy) / <alpha-value>)',
        gold: 'rgb(var(--c-gold) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Inter', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(44, 36, 33, 0.08), 0 8px 24px rgba(44, 36, 33, 0.08)',
      },
    },
  },
  plugins: [],
};
