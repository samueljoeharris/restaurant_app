import { api } from "../api/client";
import type { RestaurantMapEntry } from "../types";
import { bboxCacheKey, expandBbox, type MapBbox } from "./mapViewport";

const STALE_MS = 5 * 60 * 1000;

type CacheListener = () => void;

const entries = new Map<string, RestaurantMapEntry>();
const listeners = new Set<CacheListener>();

let fullCatalogLoadedAt = 0;
let fullCatalogEtag: string | null = null;
const bboxEtags = new Map<string, string>();
const loadedBboxes: MapBbox[] = [];

let fullFetchPromise: Promise<void> | null = null;
const bboxFetchPromises = new Map<string, Promise<void>>();

function mergeEntries(incoming: RestaurantMapEntry[]) {
  for (const row of incoming) entries.set(row.id, row);
  for (const listener of listeners) listener();
}

export function getRestaurantMapEntries(): RestaurantMapEntry[] {
  return [...entries.values()];
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
    region.minLat <= viewport.minLat &&
    region.maxLat >= viewport.maxLat &&
    region.minLng <= viewport.minLng &&
    region.maxLng >= viewport.maxLng,
  );
}

export function invalidateRestaurantMapCache() {
  entries.clear();
  loadedBboxes.length = 0;
  fullCatalogLoadedAt = 0;
  fullCatalogEtag = null;
  bboxEtags.clear();
  fullFetchPromise = null;
  bboxFetchPromises.clear();
  for (const listener of listeners) listener();
}

export async function ensureFullRestaurantCatalog(force = false): Promise<void> {
  if (!force && isFullCatalogFresh()) return;
  if (fullFetchPromise) return fullFetchPromise;

  fullFetchPromise = (async () => {
    try {
      const { rows, etag, notModified } = await api.listRestaurantsForMapCached({
        etag: force ? null : fullCatalogEtag,
      });
      if (!notModified && rows) mergeEntries(rows);
      if (etag) fullCatalogEtag = etag;
      fullCatalogLoadedAt = Date.now();
      loadedBboxes.length = 0;
    } finally {
      fullFetchPromise = null;
    }
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
      const { rows, etag, notModified } = await api.listRestaurantsForMapCached({
        bbox: fetchBbox,
        etag: force ? null : bboxEtags.get(key) ?? null,
      });
      if (!notModified && rows) {
        mergeEntries(rows);
        loadedBboxes.push(fetchBbox);
      } else if (notModified) {
        loadedBboxes.push(fetchBbox);
      }
      if (etag) bboxEtags.set(key, etag);
    } finally {
      bboxFetchPromises.delete(key);
    }
  })();

  bboxFetchPromises.set(key, promise);
  return promise;
}

export function mergeRestaurantMapEntries(incoming: RestaurantMapEntry[]) {
  mergeEntries(incoming);
}
