import { api } from "../api/client";
import { prefetchCachedResource } from "../hooks/useCachedResource";
import { placeEntryCacheKey, restaurantDetailCacheKey } from "./pageDataCache";
import { fetchRestaurantDetailBundle } from "./restaurantDetailResource";
import type { RestaurantMapEntry } from "../types";

/**
 * Warm the detail route chunk (#77) and its data cache (#78) when the user
 * signals intent — hover or touchstart on a card / sheet link (#80). Deduped
 * at the cache layer, so repeated intent is a cheap no-op.
 */

function saveDataEnabled(): boolean {
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData);
}

export function prefetchRestaurantDetail(
  entry: Pick<RestaurantMapEntry, "id" | "google_place_id">,
  idToken: string | null,
): void {
  if (saveDataEnabled()) return;
  if (entry.id) {
    const id = entry.id;
    void import("../pages/RestaurantDetailPage");
    prefetchCachedResource(restaurantDetailCacheKey(id, Boolean(idToken)), () =>
      fetchRestaurantDetailBundle(id, idToken),
    );
    return;
  }
  if (entry.google_place_id && idToken) {
    const placeId = entry.google_place_id;
    const token = idToken;
    void import("../pages/PlaceRestaurantDetailPage");
    prefetchCachedResource(placeEntryCacheKey(placeId), () => api.getPlaceEntry(placeId, token));
  }
}
