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

/**
 * One shared `getProfile` per session (#136). A fixed literal, not the
 * rotating Firebase idToken — token refresh must not bust the cache. Call
 * sites gate on `idToken` presence (`idToken ? profileCacheKey() : null`) so
 * signed-out sessions never populate it.
 */
export function profileCacheKey(): string {
  return "profile:me";
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

/**
 * After a profile or notification-preferences write (AccountPage's save
 * handlers, OnboardingModal completion — both go through api.patchProfile /
 * api.patchNotificationPreferences, which call this directly): the shared
 * profile is stale everywhere it's read.
 */
export function invalidateProfile() {
  invalidateCachedResource("profile:");
}

let knownProfileUid: string | null | undefined; // undefined = not yet observed this session

/**
 * Call once per render — before useCachedResource(profileCacheKey(), …) —
 * from any page that reads the shared profile cache, passing the current
 * `user?.uid ?? null`. Detects a changed signed-in identity (logout, or a
 * different user signing in within the same tab) and drops the stale
 * profile:me entry so a new identity never paints a previous account's
 * cached data. Firebase token refresh doesn't change uid, so this
 * intentionally never reacts to idToken.
 */
export function syncProfileIdentity(uid: string | null): void {
  if (knownProfileUid !== undefined && knownProfileUid !== uid) {
    invalidateProfile();
  }
  knownProfileUid = uid;
}
