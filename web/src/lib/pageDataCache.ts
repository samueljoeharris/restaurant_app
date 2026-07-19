import { invalidateCachedResource } from "../hooks/useCachedResource";

/**
 * Shared cache-key builders + write-path invalidation for page data cached via
 * useCachedResource (#78). Keys are prefix-invalidated, so builders and
 * invalidators must stay in sync.
 */

export function restaurantDetailCacheKey(restaurantId: string, authed: boolean): string {
  return `restaurant-detail:${restaurantId}:${authed ? "auth" : "anon"}`;
}

export function placeEntryCacheKey(placeId: string): string {
  return `place-entry:${placeId}`;
}

/** Shared profile cache (#136). Keyed on Firebase uid, not the rotating idToken. */
export function profileCacheKey(userUid: string): string {
  return `profile:me:${userUid}`;
}

/** Call after any profile or notification-prefs write so other pages revalidate. */
export function invalidateProfile() {
  invalidateCachedResource("profile:me:");
}

/**
 * After any contribution write (TTF, attribute, note — create, edit, or
 * delete): the restaurant's detail aggregates and the user's contributions
 * list are both stale.
 */
export function invalidateContributionData(restaurantId?: string | null) {
  invalidateCachedResource(
    restaurantId ? `restaurant-detail:${restaurantId}` : "restaurant-detail:",
  );
  invalidateCachedResource("contributions:");
}

/** After watch/unwatch: detail response `watched` flag + Saved list are stale. */
export function invalidateWatchData(restaurantId: string) {
  invalidateCachedResource(`restaurant-detail:${restaurantId}`);
  invalidateCachedResource("saved:");
}

/** After a Google place is materialized into the catalog, its cached entry (id: null) is stale. */
export function invalidatePlaceEntry(placeId: string) {
  invalidateCachedResource(placeEntryCacheKey(placeId));
}
