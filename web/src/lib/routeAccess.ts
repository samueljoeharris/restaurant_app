/** Route-gating rules for Layout (#72 — anonymous map browse without login wall). */

export function isContributionRoute(pathname: string): boolean {
  return (
    pathname.includes("/submit") ||
    pathname.includes("/rate") ||
    pathname.includes("/review")
  );
}

/**
 * Read-only catalog + detail routes a signed-out visitor can browse.
 * Everything else (Saved, You, contribution routes, and Google-Place detail
 * pages that require a paid Places resolve call) still redirects to /login.
 * Write intent inside these pages (watch, rate, submit, note) is gated at
 * the point of use instead — see useWatch / RestaurantDetailPage.
 */
export function isPublicRoute(pathname: string): boolean {
  if (isContributionRoute(pathname)) return false;
  if (pathname === "/map" || pathname === "/restaurants") return true;
  // Catalog restaurant detail (a stored UUID), not the Google-Place variant
  // (/restaurants/place/:placeId) which needs an authenticated Places resolve.
  return /^\/restaurants\/[^/]+$/.test(pathname);
}
