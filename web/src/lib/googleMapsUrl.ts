import type { RestaurantMapEntry } from "../types";

/** True when the venue comes from Google Places but is not yet in our SQL catalog. */
export function isGoogleOnlyEntry(
  entry: Pick<RestaurantMapEntry, "id" | "google_place_id">,
): boolean {
  return !entry.id && Boolean(entry.google_place_id);
}

type MapsEntry = Pick<
  RestaurantMapEntry,
  "google_place_id" | "google_maps_url" | "lat" | "lng" | "name" | "address"
>;

/** Google Maps URL for a map entry, with a stable fallback from place_id. */
export function googleMapsUrlForEntry(entry: MapsEntry): string | null {
  if (entry.google_maps_url?.trim()) return entry.google_maps_url.trim();
  if (entry.google_place_id) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.name)}&query_place_id=${encodeURIComponent(entry.google_place_id)}`;
  }
  if (Number.isFinite(entry.lat) && Number.isFinite(entry.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${entry.lat},${entry.lng}`;
  }
  return null;
}

type MapsOrigin = { lat: number; lng: number };

function destinationLabel(entry: MapsEntry): string | null {
  const address = entry.address?.trim();
  if (address) return address;
  const name = entry.name?.trim();
  if (name) return name;
  if (Number.isFinite(entry.lat) && Number.isFinite(entry.lng)) {
    return `${entry.lat},${entry.lng}`;
  }
  return null;
}

/** Google Maps directions URL for a venue. */
export function googleMapsDirectionsUrl(
  entry: MapsEntry,
  origin?: MapsOrigin | null,
): string | null {
  const params = new URLSearchParams({ api: "1" });
  const destination = destinationLabel(entry);
  if (entry.google_place_id) {
    if (!destination) return null;
    params.set("destination", destination);
    params.set("destination_place_id", entry.google_place_id);
  } else if (Number.isFinite(entry.lat) && Number.isFinite(entry.lng)) {
    params.set("destination", `${entry.lat},${entry.lng}`);
  } else if (destination) {
    params.set("destination", destination);
  } else {
    return null;
  }
  if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
