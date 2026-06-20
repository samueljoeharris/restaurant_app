import { api } from "../api/client";
import type { RestaurantMapEntry } from "../types";
import { mapEntryKey } from "./mapEntryKey";
import {
  bboxAround,
  bboxCacheKey,
  bboxCenter,
  bboxRadiusM,
  expandBbox,
  nearbyCacheKey,
  type MapBbox,
} from "./mapViewport";

const STALE_MS = 5 * 60 * 1000;
type CacheListener = () => void;
const entries = new Map<string, RestaurantMapEntry>();
/** Stable snapshot for useSyncExternalStore — must keep referential equality until data changes. */
let entriesSnapshot: RestaurantMapEntry[] = [];
const listeners = new Set<CacheListener>();

function rebuildEntriesSnapshot() {
  entriesSnapshot = [...entries.values()];
}
let fullCatalogLoadedAt = 0;
let fullCatalogEtag: string | null = null;
const bboxEtags = new Map<string, string>();
const loadedBboxes: MapBbox[] = [];
const loadedNearbyKeys = new Set<string>();
let fullFetchPromise: Promise<void> | null = null;
const bboxFetchPromises = new Map<string, Promise<void>>();
const nearbyFetchPromises = new Map<string, Promise<void>>();

/** @returns keys newly added (optionally excluding one pin e.g. search focus). */
function mergeEntries(incoming: RestaurantMapEntry[], excludeKey?: string): string[] {
  if (incoming.length === 0) return [];
  const newKeys: string[] = [];
  for (const row of incoming) {
    const key = mapEntryKey(row);
    const isNew = !entries.has(key);
    entries.set(key, row);
    if (isNew && key !== excludeKey) newKeys.push(key);
  }
  rebuildEntriesSnapshot();
  for (const listener of listeners) listener();
  return newKeys;
}

export function getRestaurantMapEntries(): RestaurantMapEntry[] {
  return entriesSnapshot;
}

export function subscribeRestaurantMapCache(listener: CacheListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isFullCatalogFresh(): boolean {
  return fullCatalogLoadedAt > 0 && Date.now() - fullCatalogLoadedAt < STALE_MS;
}

export function isBboxRegionLoaded(viewport: MapBbox): boolean {
  return loadedBboxes.some((region) =>
    region.minLat <= viewport.minLat && region.maxLat >= viewport.maxLat &&
    region.minLng <= viewport.minLng && region.maxLng >= viewport.maxLng);
}

export function isNearbyRegionLoaded(lat: number, lng: number, radiusM: number): boolean {
  return loadedNearbyKeys.has(nearbyCacheKey(lat, lng, radiusM));
}

export function invalidateRestaurantMapCache() {
  entries.clear(); loadedBboxes.length = 0; loadedNearbyKeys.clear();
  fullCatalogLoadedAt = 0; fullCatalogEtag = null; bboxEtags.clear();
  fullFetchPromise = null; bboxFetchPromises.clear(); nearbyFetchPromises.clear();
  rebuildEntriesSnapshot();
  for (const listener of listeners) listener();
}

export async function ensureFullRestaurantCatalog(force = false): Promise<void> {
  if (!force && isFullCatalogFresh()) return;
  if (fullFetchPromise) return fullFetchPromise;
  fullFetchPromise = (async () => {
    try {
      const { rows, etag, notModified } = await api.listRestaurantsForMapCached({ etag: force ? null : fullCatalogEtag });
      if (!notModified && rows) mergeEntries(rows);
      if (etag) fullCatalogEtag = etag;
      fullCatalogLoadedAt = Date.now(); loadedBboxes.length = 0; loadedNearbyKeys.clear();
    } finally { fullFetchPromise = null; }
  })();
  return fullFetchPromise;
}

export async function ensureRestaurantMapBbox(bbox: MapBbox, force = false): Promise<void> {
  if (!force && isBboxRegionLoaded(bbox)) return;
  const fetchBbox = expandBbox(bbox);
  const key = bboxCacheKey(fetchBbox);
  const inflight = bboxFetchPromises.get(key);
  if (inflight) return inflight;
  const promise = (async () => {
    try {
      const { rows, etag, notModified } = await api.listRestaurantsForMapCached({ bbox: fetchBbox, etag: force ? null : bboxEtags.get(key) ?? null });
      if (!notModified && rows) { mergeEntries(rows); loadedBboxes.push(fetchBbox); }
      else if (notModified) loadedBboxes.push(fetchBbox);
      if (etag) bboxEtags.set(key, etag);
    } finally { bboxFetchPromises.delete(key); }
  })();
  bboxFetchPromises.set(key, promise);
  return promise;
}

export async function ensurePlacesNearby(lat: number, lng: number, radiusM: number, token: string, force = false): Promise<void> {
  const key = nearbyCacheKey(lat, lng, radiusM);
  if (!force && isNearbyRegionLoaded(lat, lng, radiusM)) return;
  const inflight = nearbyFetchPromises.get(key);
  if (inflight) return inflight;
  const promise = (async () => {
    try {
      mergeEntries(await api.placesNearby({ lat, lng, radius_m: radiusM }, token));
      loadedNearbyKeys.add(key);
    } finally { nearbyFetchPromises.delete(key); }
  })();
  nearbyFetchPromises.set(key, promise);
  return promise;
}

export async function ensureViewportRestaurants(bbox: MapBbox, token: string | null, force = false): Promise<void> {
  if (token) {
    const center = bboxCenter(bbox);
    return ensurePlacesNearby(center.lat, center.lng, bboxRadiusM(bbox), token, force);
  }
  return ensureRestaurantMapBbox(bbox, force);
}

export async function ensureNearbyAt(lat: number, lng: number, radiusM: number, token: string | null, force = false): Promise<void> {
  if (token) return ensurePlacesNearby(lat, lng, radiusM, token, force);
  return ensureRestaurantMapBbox(bboxAround(lat, lng, radiusM / 111_320), force);
}

export function mergeRestaurantMapEntries(
  incoming: RestaurantMapEntry[],
  excludeKey?: string,
): string[] {
  return mergeEntries(incoming, excludeKey);
}

/** Keep map/list cards in sync after a watch toggle (catalog entries only). */
export function setRestaurantWatched(restaurantId: string, watched: boolean) {
  for (const [key, entry] of entries) {
    if (entry.id === restaurantId) {
      entries.set(key, { ...entry, watched });
      rebuildEntriesSnapshot();
      for (const listener of listeners) listener();
      return;
    }
  }
}
