import type { PlaceResolveResponse } from "../types";

export const DEFAULT_SEARCH_RADIUS_M = 8000;
/** Minimum allowed by POST /v1/coverage/ensure — tight seed around one venue. */
export const RESTAURANT_SEED_RADIUS_M = 1000;

export interface PlaceSearchPending {
  place_id: string;
  label: string;
  session_token: string;
}

export interface RestaurantSearchSelection {
  restaurant_id: string;
  lat?: number;
  lng?: number;
  name?: string;
}

export function buildRadiusSearchParams(resolved: PlaceResolveResponse): URLSearchParams {
  const params = new URLSearchParams();
  params.set("lat", String(resolved.lat));
  params.set("lng", String(resolved.lng));
  params.set("radius", String(DEFAULT_SEARCH_RADIUS_M));
  params.set("place", resolved.label);
  return params;
}

export function buildPendingPlaceParams(pending: PlaceSearchPending): URLSearchParams {
  const params = new URLSearchParams();
  params.set("place_id", pending.place_id);
  params.set("place", pending.label);
  return params;
}

export function appendRestaurantFocusToParams(
  params: URLSearchParams,
  selection: RestaurantSearchSelection,
): void {
  params.set("focus", selection.restaurant_id);
  if (selection.lat != null && selection.lng != null) {
    params.set("flat", String(selection.lat));
    params.set("flng", String(selection.lng));
  } else {
    params.delete("flat");
    params.delete("flng");
  }
}

export function readFocusLocationFromParams(
  params: URLSearchParams,
  state: MapFocusState | null | undefined,
): { lat: number; lng: number } | null {
  if (state?.focusLocation) return state.focusLocation;
  const flat = params.get("flat");
  const flng = params.get("flng");
  if (!flat || !flng) return null;
  const lat = parseFloat(flat);
  const lng = parseFloat(flng);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

export function buildMapFocusPath(selection: RestaurantSearchSelection): string {
  const params = new URLSearchParams();
  appendRestaurantFocusToParams(params, selection);
  return `/map?${params.toString()}`;
}

export function buildMapPendingPlacePath(pending: PlaceSearchPending): string {
  return `/map?${buildPendingPlaceParams(pending).toString()}`;
}

export interface MapFocusState {
  focusLocation?: { lat: number; lng: number };
  placeSessionToken?: string;
}
