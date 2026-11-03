/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Theme-aware scale: 950 = page background ... 100 = primary text. Values live in index.css.
        ink: Object.fromEntries([950, 900, 850, 800, 700, 600, 400, 300, 100].map((n) => [n, `rgb(var(--ink-${n}) / <alpha-value>)`])),
        line: 'rgb(var(--line) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        mint: { 300: '#5EEAD4', 400: '#2DD4BF', 500: '#14B8A6', 600: '#0D9488', 700: '#0F766E' },
        coral: { 300: '#F7A08A', 500: '#EF6A5B' },
        violet: { 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED' },
        cream: '#F6F2E9',
      },
      fontFamily: {
        display: ['"Google Sans Variable"', '"Google Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Google Sans Variable"', '"Google Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: { glow: '0 8px 24px -10px rgba(13,148,136,.55)', soft: '0 1px 2px rgba(31,36,48,.04), 0 8px 24px -12px rgba(31,36,48,.12)' },
      keyframes: { 'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } } },
      animation: { 'fade-up': 'fade-up .35s ease-out both' },
    },
  },
  plugins: [],
};
