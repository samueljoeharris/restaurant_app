const MASCOT_PNG = "/images/scout-mascot.png";
const MASCOT_WEBP = "/images/scout-mascot.webp";

/** Illustrated scout mascot for onboarding, auth, and empty states (geometric ScoutLogo stays the app mark). */
export function ScoutMascot({
  className,
  size = 160,
  alt = "Little Scout — your friendly restaurant scout",
}: {
  className?: string;
  size?: number;
  alt?: string;
}) {
  return (
    <picture>
      <source srcSet={MASCOT_WEBP} type="image/webp" />
      <img
        src={MASCOT_PNG}
        alt={alt}
        width={size}
        height={size}
        className={className}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}

export const SCOUT_MASCOT_PATH = MASCOT_PNG;
