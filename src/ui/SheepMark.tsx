// The White Sheep brand mark — a wool cloud on legs. Used in the shell and login.
export function SheepMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="כבשה לבנה"
      fill="none"
    >
      <path
        d="M9 19a3.4 3.4 0 0 1 .3-6.7 4.2 4.2 0 0 1 8-1.4 3.6 3.6 0 0 1 5.2 3.1A3.3 3.3 0 0 1 22 19z"
        fill="#f4f6f2"
        stroke="#17756b"
        strokeWidth="1.3"
      />
      <ellipse cx="21.4" cy="20.2" rx="3" ry="3.4" fill="#1e2a28" />
      <circle cx="20.4" cy="19.6" r="0.7" fill="#f4f6f2" />
      <rect x="12" y="18.6" width="1.3" height="4" rx="0.6" fill="#1e2a28" />
      <rect x="16" y="18.6" width="1.3" height="4" rx="0.6" fill="#1e2a28" />
    </svg>
  );
}
