import type { RestaurantMapEntry } from "../types";

export function mapEntryKey(entry: Pick<RestaurantMapEntry, "id" | "google_place_id">): string {
  if (entry.id) return entry.id;
  if (entry.google_place_id) return `place:${entry.google_place_id}`;
  throw new Error("RestaurantMapEntry requires id or google_place_id");
}

export function findMapEntry(
  entries: RestaurantMapEntry[],
  key: string | null,
): RestaurantMapEntry | undefined {
  if (!key) return undefined;
  return entries.find((entry) => mapEntryKey(entry) === key);
}

export function restaurantDetailPath(entry: Pick<RestaurantMapEntry, "id" | "google_place_id">): string {
  if (entry.id) return `/restaurants/${entry.id}`;
  if (entry.google_place_id) return `/restaurants/place/${encodeURIComponent(entry.google_place_id)}`;
  return "/restaurants";
}

export function restaurantSubmitPath(entry: Pick<RestaurantMapEntry, "id" | "google_place_id">): string {
  if (entry.id) return `/restaurants/${entry.id}/submit`;
  if (entry.google_place_id) {
    return `/restaurants/place/${encodeURIComponent(entry.google_place_id)}/submit`;
  }
  return "/restaurants";
}

export function restaurantReviewPath(entry: Pick<RestaurantMapEntry, "id" | "google_place_id">): string {
  if (entry.id) return `/restaurants/${entry.id}/review`;
  if (entry.google_place_id) {
    return `/restaurants/place/${encodeURIComponent(entry.google_place_id)}/review`;
  }
  return "/restaurants";
}

export function restaurantRatePath(entry: Pick<RestaurantMapEntry, "id" | "google_place_id">): string {
  if (entry.id) return `/restaurants/${entry.id}/rate`;
  if (entry.google_place_id) {
    return `/restaurants/place/${encodeURIComponent(entry.google_place_id)}/rate`;
  }
  return "/restaurants";
}
