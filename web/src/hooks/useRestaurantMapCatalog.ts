import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  ensureFullRestaurantCatalog,
  getRestaurantMapEntries,
  invalidateRestaurantMapCache,
  mergeRestaurantMapEntries,
  subscribeRestaurantMapCache,
} from "../lib/restaurantMapCache";
import type { RestaurantMapEntry } from "../types";

export function useRestaurantMapEntries(): RestaurantMapEntry[] {
  return useSyncExternalStore(
    subscribeRestaurantMapCache,
    getRestaurantMapEntries,
    getRestaurantMapEntries,
  );
}

/** Load (or reuse cached) full catalog — for Home landing stats. */
export function useFullRestaurantCatalog() {
  const restaurants = useRestaurantMapEntries();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void ensureFullRestaurantCatalog()
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await ensureFullRestaurantCatalog(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  return { restaurants, loading, error, refresh };
}

export { mergeRestaurantMapEntries, invalidateRestaurantMapCache };
