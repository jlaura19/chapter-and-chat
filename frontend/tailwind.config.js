/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        parchment: '#FDFBF7',
        sepia: '#2C2421',
        burgundy: '#7A2E22',
        gold: '#C5A880',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"EB Garamond"', 'Garamond', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(44, 36, 33, 0.08), 0 8px 24px rgba(44, 36, 33, 0.08)',
      },
    },
  },
  plugins: [],
};
