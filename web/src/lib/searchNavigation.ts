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
