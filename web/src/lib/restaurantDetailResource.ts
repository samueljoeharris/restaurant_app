import { api } from "../api/client";
import { getCachedResource } from "../hooks/useCachedResource";
import { profileCacheKey } from "./pageDataCache";
import type { AttributeEntry, RestaurantDetailResponse, RestaurantNote } from "../types";

/**
 * Everything the restaurant detail page needs, fetched as one cacheable
 * bundle (#78). Shared with intent prefetch (#80) so a hover warms exactly
 * the data the page will read.
 */
export interface RestaurantDetailBundle {
  detail: RestaurantDetailResponse;
  attributes: AttributeEntry[];
  notes: RestaurantNote[];
  kidsAges: number[];
}

export async function fetchRestaurantDetailBundle(
  id: string,
  idToken: string | null,
): Promise<RestaurantDetailBundle> {
  const [detail, attrs, notesRes, profile] = await Promise.all([
    api.getRestaurant(id, idToken),
    api.getAttributes(id),
    api.listNotes(id),
    // Shared profile:me cache (#136) — reads through instead of its own
    // private getProfile call, so this bundle never issues a redundant fetch.
    idToken
      ? getCachedResource(profileCacheKey(), () => api.getProfile(idToken)).catch(() => null)
      : Promise.resolve(null),
  ]);
  return {
    detail,
    attributes: Object.values(attrs.attributes),
    notes: notesRes.notes,
    kidsAges: profile?.kids_ages ?? [],
  };
}
