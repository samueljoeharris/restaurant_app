/** Bounding-box helpers for viewport-scoped map loads. */

export type MapBbox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export function expandBbox(bbox: MapBbox, factor = 0.15): MapBbox {
  const latPad = (bbox.maxLat - bbox.minLat) * factor;
  const lngPad = (bbox.maxLng - bbox.minLng) * factor;
  return {
    minLat: bbox.minLat - latPad,
    maxLat: bbox.maxLat + latPad,
    minLng: bbox.minLng - lngPad,
    maxLng: bbox.maxLng + lngPad,
  };
}

export function bboxContains(outer: MapBbox, inner: MapBbox): boolean {
  return (
    inner.minLat >= outer.minLat &&
    inner.maxLat <= outer.maxLat &&
    inner.minLng >= outer.minLng &&
    inner.maxLng <= outer.maxLng
  );
}

export function bboxAround(lat: number, lng: number, delta = 0.02): MapBbox {
  return {
    minLat: lat - delta,
    maxLat: lat + delta,
    minLng: lng - delta,
    maxLng: lng + delta,
  };
}

export function bboxCacheKey(bbox: MapBbox): string {
  const round = (n: number) => n.toFixed(4);
  return `${round(bbox.minLat)}:${round(bbox.maxLat)}:${round(bbox.minLng)}:${round(bbox.maxLng)}`;
}

/** Pilot default center (Dedham) with a generous bbox for landing-page stats. */
export const PILOT_DEFAULT_BBOX: MapBbox = {
  minLat: 42.12,
  maxLat: 42.36,
  minLng: -71.32,
  maxLng: -71.0,
};
