/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        card: token('card'),
        raised: token('raised'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        accent: token('accent'),
        'accent-ink': token('accent-ink'),
        'on-accent': token('on-accent'),
        side: token('side'),
        danger: token('danger'),
        created: token('created'),
        'created-ink': token('created-ink'),
        transit: token('transit'),
        'transit-ink': token('transit-ink'),
        delivered: token('delivered'),
        'delivered-ink': token('delivered-ink'),
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.05), 0 6px 20px -10px rgb(var(--shadow) / 0.12)',
        pop: '0 24px 60px -12px rgb(var(--shadow) / 0.35)',
      },
      keyframes: {
        pop: {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        toast: {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        pop: 'pop 180ms ease-out',
        toast: 'toast 200ms ease-out',
      },
    },
  },
  plugins: [],
}
