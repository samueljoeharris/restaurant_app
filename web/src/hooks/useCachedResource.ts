import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal stale-while-revalidate for page data (#78). Cached results render
 * instantly on revisit while a background refetch keeps them current — the
 * same idea as restaurantMapCache, generalized. Module-level, so the cache
 * survives route changes but not reloads.
 */

type CacheEntry = { data: unknown; fetchedAt: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/** Drop cached entries whose key starts with `prefix` (call after writes). */
export function invalidateCachedResource(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** Warm the cache on user intent (#80). No-op when cached or in flight. */
export function prefetchCachedResource<T>(key: string, fetcher: () => Promise<T>): void {
  if (cache.has(key) || inflight.has(key)) return;
  fetchDeduped(key, fetcher).catch(() => {
    // Best-effort: the page fetch will surface any real error.
  });
}

function fetchDeduped<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, fetchedAt: Date.now() });
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

interface CachedResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useCachedResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: { onData?: (data: T) => void } = {},
): CachedResourceState<T> & { refresh: () => Promise<void> } {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onDataRef = useRef(options.onData);
  onDataRef.current = options.onData;
  const keyRef = useRef(key);
  keyRef.current = key;

  const [state, setState] = useState<CachedResourceState<T>>(() => {
    const cached = key ? cache.get(key) : undefined;
    return {
      data: (cached?.data as T) ?? null,
      loading: Boolean(key) && !cached,
      error: null,
    };
  });

  const refresh = useCallback(async () => {
    const requestKey = keyRef.current;
    if (!requestKey) return;
    if (!cache.has(requestKey)) {
      setState((s) => ({ ...s, loading: true }));
    }
    try {
      const data = await fetchDeduped(requestKey, () => fetcherRef.current());
      if (keyRef.current !== requestKey) return;
      setState({ data, loading: false, error: null });
      onDataRef.current?.(data);
    } catch (err) {
      if (keyRef.current !== requestKey) return;
      setState((s) => ({
        data: s.data,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load",
      }));
    }
  }, []);

  useEffect(() => {
    if (!key) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const cached = cache.get(key);
    if (cached) {
      setState({ data: cached.data as T, loading: false, error: null });
      onDataRef.current?.(cached.data as T);
    } else {
      setState({ data: null, loading: true, error: null });
    }
    void refresh();
  }, [key, refresh]);

  return { ...state, refresh };
}
