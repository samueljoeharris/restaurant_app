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

export function bboxCenter(bbox: MapBbox): { lat: number; lng: number } {
  return { lat: (bbox.minLat + bbox.maxLat) / 2, lng: (bbox.minLng + bbox.maxLng) / 2 };
}

export function bboxRadiusM(bbox: MapBbox): number {
  const centerLat = (bbox.minLat + bbox.maxLat) / 2;
  const latM = ((bbox.maxLat - bbox.minLat) * 111_320) / 2;
  const lngM = ((bbox.maxLng - bbox.minLng) * 111_320 * Math.cos((centerLat * Math.PI) / 180)) / 2;
  const radius = Math.min(latM, lngM);
  return Math.round(Math.max(1000, Math.min(25_000, radius)));
}

export function nearbyCacheKey(lat: number, lng: number, radiusM: number): string {
  return `${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusM}`;
}
