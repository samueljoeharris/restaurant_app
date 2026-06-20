import type { PlacePracticalResponse } from "../types";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  data: PlacePracticalResponse;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

export function getCachedPlacePractical(placeId: string): PlacePracticalResponse | null {
  const entry = cache.get(placeId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(placeId);
    return null;
  }
  return entry.data;
}

export function setCachedPlacePractical(placeId: string, data: PlacePracticalResponse): void {
  cache.set(placeId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearPlacePracticalCache(): void {
  cache.clear();
}
