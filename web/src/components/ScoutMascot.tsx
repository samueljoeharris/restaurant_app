/**
 * Illustrated scout mascot for onboarding, auth, and empty states (geometric ScoutLogo stays the app mark).
 * Flat geometric fox built from brand primitives — a placeholder until real illustrated fox art is
 * commissioned (see docs/design-system/readme.md § Mascot caveat). Swap the SVG below for an <img>
 * pointing at supplied art when it's ready; keep the ScoutMascot name/props so call sites don't change.
 */
export function ScoutMascot({
  className,
  size = 160,
  alt = "Little Scout — your friendly restaurant fox",
}: {
  className?: string;
  size?: number;
  alt?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={alt}
    >
      {/* shoulders */}
      <path d="M42 160 Q42 122 80 122 Q118 122 118 160 Z" fill="#FBA63C" />
      {/* backpack strap */}
      <path d="M55 128 L70 160 M105 128 L90 160" stroke="#2C2722" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
      {/* neckerchief */}
      <path d="M60 118 L100 118 L80 142 Z" fill="#F08A2E" />
      <circle cx="80" cy="120" r="4" fill="#F08A2E" />
      {/* ears */}
      <path d="M38 46 L28 8 L58 38 Z" fill="#FBA63C" />
      <path d="M122 46 L132 8 L102 38 Z" fill="#FBA63C" />
      <path d="M40 38 L34 16 L52 34 Z" fill="#2C2722" opacity="0.85" />
      <path d="M120 38 L126 16 L108 34 Z" fill="#2C2722" opacity="0.85" />
      {/* head */}
      <path d="M80 34 Q116 34 116 76 Q116 108 80 112 Q44 108 44 76 Q44 34 80 34 Z" fill="#FBA63C" />
      {/* cap */}
      <path d="M43 58 Q80 30 117 58 L117 62 Q80 48 43 62 Z" fill="var(--color-brand)" />
      <path d="M43 62 Q80 46 117 62 Q117 50 80 42 Q43 50 43 62 Z" fill="var(--color-brand)" />
      <circle cx="80" cy="50" r="4.5" fill="var(--color-accent)" />
      {/* muzzle */}
      <path d="M80 78 Q104 80 100 100 Q92 112 80 112 Q68 112 60 100 Q56 80 80 78 Z" fill="#FBF6EC" />
      {/* eyes */}
      <circle cx="66" cy="76" r="4.5" fill="#2C2722" />
      <circle cx="94" cy="76" r="4.5" fill="#2C2722" />
      <circle cx="64.5" cy="74.5" r="1.3" fill="#FBF6EC" />
      <circle cx="92.5" cy="74.5" r="1.3" fill="#FBF6EC" />
      {/* nose */}
      <path d="M77 96 L83 96 L80 100.5 Z" fill="#2C2722" />
    </svg>
  );
}
