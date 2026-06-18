import { useCallback, useEffect, useRef } from "react";

import {
  ensureRestaurantMapBbox,
  isBboxRegionLoaded,
} from "../lib/restaurantMapCache";
import { expandBbox, type MapBbox } from "../lib/mapViewport";

function bboxKey(bbox: MapBbox): string {
  return `${bbox.minLat.toFixed(4)},${bbox.maxLat.toFixed(4)},${bbox.minLng.toFixed(4)},${bbox.maxLng.toFixed(4)}`;
}

/**
 * Debounced viewport bbox fetch for catalog explore mode.
 * Merges into the shared restaurant map cache. Skips the first idle event
 * after resetViewportGate() (e.g. after focus pan).
 */
export function useMapViewportRestaurants(enabled: boolean) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBboxRef = useRef<string | null>(null);
  const skipNextRef = useRef(false);

  const resetViewportGate = useCallback(() => {
    skipNextRef.current = true;
    lastBboxRef.current = null;
  }, []);

  const fetchBbox = useCallback((bbox: MapBbox) => {
    const target = expandBbox(bbox, 0.05);
    if (isBboxRegionLoaded(target)) return;
    void ensureRestaurantMapBbox(target).catch(() => {
      /* non-blocking */
    });
  }, []);

  const onViewportChange = useCallback(
    (bbox: MapBbox) => {
      if (!enabled) return;
      if (skipNextRef.current) {
        skipNextRef.current = false;
        return;
      }
      const key = bboxKey(bbox);
      if (lastBboxRef.current === key) return;

      if (debounceRef.current != null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        lastBboxRef.current = key;
        fetchBbox(bbox);
      }, 300);
    },
    [enabled, fetchBbox],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
    };
  }, []);

  return { onViewportChange, resetViewportGate, fetchBbox };
}

export type { MapBbox };
