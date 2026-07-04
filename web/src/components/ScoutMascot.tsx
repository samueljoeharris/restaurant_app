/**
 * Illustrated scout mascot for onboarding, auth, and empty states (geometric ScoutLogo stays the app mark).
 * Flat geometric fox built from brand primitives — a placeholder until real illustrated fox art is
 * commissioned (see docs/design-system/readme.md § Mascot caveat). Swap the SVG below for an <img>
 * pointing at supplied art when it's ready; keep the ScoutMascot name/props so call sites don't change.
 */
const FOX_FUR = "#FBA63C";
const FOX_CREAM = "#FBF6EC";
const FOX_INK = "#2C2722";

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
      <path d="M44 160 Q44 118 80 116 Q116 118 116 160 Z" fill={FOX_FUR} />
      {/* ears */}
      <path d="M48 42 Q34 16 32 8 Q46 12 66 30 Z" fill={FOX_FUR} />
      <path d="M112 42 Q126 16 128 8 Q114 12 94 30 Z" fill={FOX_FUR} />
      <path d="M50 36 Q41 20 38 14 Q49 18 60 28 Z" fill={FOX_INK} opacity="0.8" />
      <path d="M110 36 Q119 20 122 14 Q111 18 100 28 Z" fill={FOX_INK} opacity="0.8" />
      {/* cheek tufts */}
      <path d="M44 78 L28 88 L46 94 Z" fill={FOX_FUR} />
      <path d="M116 78 L132 88 L114 94 Z" fill={FOX_FUR} />
      {/* head */}
      <path d="M80 26 Q120 26 122 70 Q123 102 80 110 Q37 102 38 70 Q40 26 80 26 Z" fill={FOX_FUR} />
      {/* muzzle */}
      <path d="M80 72 Q106 74 103 96 Q96 110 80 110 Q64 110 57 96 Q54 74 80 72 Z" fill={FOX_CREAM} />
      {/* eyes */}
      <circle cx="64" cy="66" r="5" fill={FOX_INK} />
      <circle cx="96" cy="66" r="5" fill={FOX_INK} />
      <circle cx="62.4" cy="64.2" r="1.5" fill={FOX_CREAM} />
      <circle cx="94.4" cy="64.2" r="1.5" fill={FOX_CREAM} />
      {/* nose */}
      <path d="M75.5 90 L84.5 90 L80 96.5 Z" fill={FOX_INK} />
      {/* scout neckerchief */}
      <path d="M54 118 Q80 132 106 118 L80 150 Z" fill="var(--color-brand)" />
      <path d="M54 118 Q80 132 106 118 Q80 124 54 118 Z" fill={FOX_INK} opacity="0.12" />
      <circle cx="80" cy="128" r="5.5" fill="var(--color-accent)" />
    </svg>
  );
}
