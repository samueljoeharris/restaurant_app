/** Compass mark — sky body, mango lens (Bluebird brand). Uses theme CSS vars. */
export function ScoutLogo({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Little Scout"
    >
      <circle cx="20" cy="20" r="18" fill="var(--color-brand)" />
      <circle
        cx="20"
        cy="20"
        r="14"
        fill="none"
        stroke="var(--color-text-inverse)"
        strokeWidth="1.5"
        opacity="0.5"
      />
      <path
        d="M20 6 L22.5 17.5 L20 20 L17.5 17.5 Z"
        fill="var(--color-text-inverse)"
        opacity="0.9"
      />
      <path
        d="M20 34 L17.5 22.5 L20 20 L22.5 22.5 Z"
        fill="var(--color-text-inverse)"
        opacity="0.35"
      />
      <path
        d="M6 20 L17.5 17.5 L20 20 L17.5 22.5 Z"
        fill="var(--color-text-inverse)"
        opacity="0.55"
      />
      <path
        d="M34 20 L22.5 22.5 L20 20 L22.5 17.5 Z"
        fill="var(--color-text-inverse)"
        opacity="0.55"
      />
      <circle cx="20" cy="20" r="6" fill="var(--color-text-inverse)" />
      <circle cx="20" cy="20" r="4" fill="var(--color-accent)" />
    </svg>
  );
}
