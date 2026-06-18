import type { RestaurantMapEntry } from "../types";

/** Close-up when the user picked a specific restaurant. */
export const MAP_ZOOM_VENUE_SEARCH = 17;
/** Wider view for neighborhood / area searches. */
export const MAP_ZOOM_AREA_SEARCH = 12;

export type MapSearchZoomMode = "venue" | "area";

const AREA_PLACE_TAGS = new Set([
  "locality",
  "neighborhood",
  "sublocality",
  "sublocality level 1",
  "administrative area level 1",
  "administrative area level 2",
  "administrative area level 3",
  "postal code",
  "political",
  "route",
  "street address",
]);

/** Google place predictions for cities/neighborhoods vs a specific restaurant. */
export function isAreaPlaceEntry(entry: RestaurantMapEntry): boolean {
  if (entry.id) return false;
  const tags = entry.cuisine_tags.map((t) => t.toLowerCase());
  return tags.some((t) => AREA_PLACE_TAGS.has(t));
}

export function searchZoomModeForEntry(
  entry: RestaurantMapEntry | undefined,
  hasFocus: boolean,
  isRadiusMode: boolean,
): MapSearchZoomMode | null {
  if (hasFocus && entry && isAreaPlaceEntry(entry)) return "area";
  if (hasFocus) return "venue";
  if (isRadiusMode) return "area";
  return null;
}
