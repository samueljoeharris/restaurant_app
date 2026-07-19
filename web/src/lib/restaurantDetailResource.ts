import { api } from "../api/client";
import type { AttributeEntry, RestaurantDetailResponse, RestaurantNote } from "../types";

/**
 * Core restaurant detail data fetched as one cacheable bundle (#78).
 * The caller provides the signed-in user's `kidsAges` separately from the shared
 * `profile:me` cache (#136) so this bundle stays user-agnostic and can be warmed
 * by intent prefetch (#80) without duplicating profile GETs.
 */
export interface RestaurantDetailBundle {
  detail: RestaurantDetailResponse;
  attributes: AttributeEntry[];
  notes: RestaurantNote[];
}

export async function fetchRestaurantDetailBundle(
  id: string,
  idToken: string | null,
): Promise<RestaurantDetailBundle> {
  const [detail, attrs, notesRes] = await Promise.all([
    api.getRestaurant(id, idToken),
    api.getAttributes(id),
    api.listNotes(id),
  ]);
  return {
    detail,
    attributes: Object.values(attrs.attributes),
    notes: notesRes.notes,
  };
}
