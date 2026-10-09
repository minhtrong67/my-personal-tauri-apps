const names = [
  'primary', 'on-primary', 'primary-container', 'on-primary-container',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'error', 'on-error', 'error-container', 'on-error-container',
  'surface', 'surface-dim', 'surface-bright', 'surface-variant',
  'surface-container-lowest', 'surface-container-low', 'surface-container',
  'surface-container-high', 'surface-container-highest',
  'on-surface', 'on-surface-variant', 'outline', 'outline-variant',
  'inverse-surface', 'inverse-on-surface', 'inverse-primary',
];
const colors = Object.fromEntries(names.map((n) => [n, `rgb(var(--md-${n}) / <alpha-value>)`]));

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors,
      fontFamily: { sans: ['system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'] },
      fontSize: {
        'display-sm': ['36px', { lineHeight: '44px', fontWeight: '400' }],
        'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '400' }],
        'headline-md': ['28px', { lineHeight: '36px', fontWeight: '400' }],
        'headline-sm': ['24px', { lineHeight: '32px', fontWeight: '400' }],
        'title-lg': ['22px', { lineHeight: '28px', fontWeight: '400' }],
        'title-md': ['16px', { lineHeight: '24px', fontWeight: '500', letterSpacing: '0.15px' }],
        'title-sm': ['14px', { lineHeight: '20px', fontWeight: '500', letterSpacing: '0.1px' }],
        'body-lg': ['16px', { lineHeight: '24px', letterSpacing: '0.5px' }],
        'body-md': ['14px', { lineHeight: '20px', letterSpacing: '0.25px' }],
        'body-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.4px' }],
        'label-lg': ['14px', { lineHeight: '20px', fontWeight: '500', letterSpacing: '0.1px' }],
        'label-md': ['12px', { lineHeight: '16px', fontWeight: '500', letterSpacing: '0.5px' }],
      },
      borderRadius: { 'm3-xl': '28px' },
      transitionTimingFunction: { emphasized: 'cubic-bezier(0.2, 0, 0, 1)' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.92)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-left': { from: { transform: 'translateX(24px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        eq: { '0%,100%': { transform: 'scaleY(0.3)' }, '50%': { transform: 'scaleY(1)' } },
        rise: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'card-in': { from: { opacity: '0', transform: 'translateY(12px) scale(0.97)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        pop: { '0%': { transform: 'scale(0.6)', opacity: '0' }, '60%': { transform: 'scale(1.12)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in .2s ease-out',
        'scale-in': 'scale-in .22s cubic-bezier(0.2,0,0,1)',
        'slide-up': 'slide-up .3s cubic-bezier(0.2,0,0,1)',
        'slide-left': 'slide-left .28s cubic-bezier(0.2,0,0,1)',
        rise: 'rise .38s cubic-bezier(0.2,0,0,1) both',
        'card-in': 'card-in .42s cubic-bezier(0.2,0,0,1) both',
        pop: 'pop .3s cubic-bezier(0.2,0,0,1) both',
      },
    },
  },
  plugins: [],
};
