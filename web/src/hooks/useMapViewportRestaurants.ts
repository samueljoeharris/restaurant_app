import { useCallback, useEffect, useRef } from "react";

import {
  ensureViewportRestaurants,
  isBboxRegionLoaded,
  isNearbyRegionLoaded,
} from "../lib/restaurantMapCache";
import { bboxCenter, bboxRadiusM, expandBbox, type MapBbox } from "../lib/mapViewport";

function bboxKey(bbox: MapBbox): string {
  return `${bbox.minLat.toFixed(4)},${bbox.maxLat.toFixed(4)},${bbox.minLng.toFixed(4)},${bbox.maxLng.toFixed(4)}`;
}

function viewportLoaded(bbox: MapBbox, token: string | null): boolean {
  const target = expandBbox(bbox, 0.05);
  if (token) {
    const center = bboxCenter(target);
    return isNearbyRegionLoaded(center.lat, center.lng, bboxRadiusM(target));
  }
  return isBboxRegionLoaded(target);
}

export function useMapViewportRestaurants(enabled: boolean, token: string | null) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBboxRef = useRef<string | null>(null);
  const skipNextRef = useRef(false);

  const resetViewportGate = useCallback(() => {
    skipNextRef.current = true;
    lastBboxRef.current = null;
  }, []);

  const fetchViewport = useCallback(
    (bbox: MapBbox) => {
      if (viewportLoaded(bbox, token)) return;
      void ensureViewportRestaurants(expandBbox(bbox, 0.05), token).catch(() => {});
    },
    [token],
  );

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
        fetchViewport(bbox);
      }, 300);
    },
    [enabled, fetchViewport],
  );

  useEffect(() => () => {
    if (debounceRef.current != null) clearTimeout(debounceRef.current);
  }, []);

  return { onViewportChange, resetViewportGate, fetchViewport };
}

export type { MapBbox };
