import type { RestaurantMapEntry } from "../types";

/** True when the venue comes from Google Places but is not yet in our SQL catalog. */
export function isGoogleOnlyEntry(
  entry: Pick<RestaurantMapEntry, "id" | "google_place_id">,
): boolean {
  return !entry.id && Boolean(entry.google_place_id);
}

/** Google Maps URL for a map entry, with a stable fallback from place_id. */
export function googleMapsUrlForEntry(
  entry: Pick<RestaurantMapEntry, "google_place_id" | "google_maps_url" | "lat" | "lng" | "name">,
): string | null {
  if (entry.google_maps_url?.trim()) return entry.google_maps_url.trim();
  if (entry.google_place_id) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.name)}&query_place_id=${encodeURIComponent(entry.google_place_id)}`;
  }
  if (Number.isFinite(entry.lat) && Number.isFinite(entry.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${entry.lat},${entry.lng}`;
  }
  return null;
}
