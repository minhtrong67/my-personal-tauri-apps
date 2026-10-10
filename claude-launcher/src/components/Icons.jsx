export const Logo = ({ size = 44 }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#9aa5ff" />
        <stop offset="1" stopColor="#5862d6" />
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="11" fill="url(#lg)" />
    <path
      d="M24 8.5 26.05 21.95 39.5 24 26.05 26.05 24 39.5 21.95 26.05 8.5 24 21.95 21.95Z"
      fill="#12141c"
    />
  </svg>
);

export const Sliders = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </svg>
);
