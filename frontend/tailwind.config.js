/** @type {import('tailwindcss').Config} */
export default {
  // Relative to this file, so builds work when run from the repo root.
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  theme: {
    extend: {
      colors: {
        // Theme-aware scale: 950 = page background ... 100 = primary text. Values live in index.css.
        ink: Object.fromEntries([950, 900, 850, 800, 700, 600, 400, 300, 100].map((n) => [n, `rgb(var(--ink-${n}) / <alpha-value>)`])),
        line: 'rgb(var(--line) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        // The primary brand colour. The name is historical (it used to be teal); it is purple now.
        mint: { 300: '#C4B5FD', 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9' },
        coral: { 300: '#F7A08A', 500: '#EF6A5B' },
        violet: { 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED' },
      },
      fontFamily: {
        display: ['"Google Sans Variable"', '"Google Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Google Sans Variable"', '"Google Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: { glow: '0 6px 18px -8px rgba(124,58,237,.55)', soft: '0 1px 2px rgba(15,20,36,.05), 0 2px 8px -4px rgba(15,20,36,.06)' },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        'rise': { from: { opacity: 0, transform: 'translateY(22px) scale(.98)' }, to: { opacity: 1, transform: 'none' } },
        'float': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        'float-slow': { '0%,100%': { transform: 'translateY(0) rotate(-2deg)' }, '50%': { transform: 'translateY(-14px) rotate(2deg)' } },
        'marquee': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'shimmer': { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        'pan': { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        'pop': { '0%': { transform: 'scale(.6)', opacity: 0 }, '70%': { transform: 'scale(1.08)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
        'ping-soft': { '0%': { transform: 'scale(1)', opacity: 0.55 }, '100%': { transform: 'scale(2.2)', opacity: 0 } },
        'drift': { '0%,100%': { transform: 'translate(0,0)' }, '50%': { transform: 'translate(24px,-18px)' } },
        'blink': { '0%,49%': { opacity: 1 }, '50%,100%': { opacity: 0 } },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
        'rise': 'rise .7s cubic-bezier(.2,.8,.2,1) both',
        'float': 'float 5s ease-in-out infinite',
        'float-slow': 'float-slow 7s ease-in-out infinite',
        'marquee': 'marquee 38s linear infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'pan': 'pan 8s ease-in-out infinite',
        'pop': 'pop .5s cubic-bezier(.2,.8,.2,1) both',
        'ping-soft': 'ping-soft 2.4s ease-out infinite',
        'drift': 'drift 14s ease-in-out infinite',
        'blink': 'blink 1s steps(1) infinite',
      },
    },
  },
  plugins: [],
};
