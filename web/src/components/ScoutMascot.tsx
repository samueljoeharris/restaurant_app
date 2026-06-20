const MASCOT_SRC = "/images/scout-mascot.png";

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
    <img
      src={MASCOT_SRC}
      alt={alt}
      width={size}
      height={size}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}

export const SCOUT_MASCOT_PATH = MASCOT_SRC;
