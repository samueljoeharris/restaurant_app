import type { RestaurantMapEntry } from "../types";

export type ScoutFilter = "all" | "fast-starters" | "parent-data" | "needs-data";

export type ExploreFacet = {
  key: string;
  label: string;
  count: number;
};

const ZIP_RE = /\b(\d{5})(?:-\d{4})?\b/;
const GENERIC_TAGS = new Set(["restaurant", "food", "point of interest", "establishment"]);

export function parseZipFromAddress(address: string): string | null {
  return address.match(ZIP_RE)?.[1] ?? null;
}

export function parseCityFromAddress(address: string): string | null {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const city = parts[parts.length - 3];
  if (!city || /^\d/.test(city)) return null;
  return city;
}

export function tagLabel(tag: string): string {
  if (!tag) return tag;
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

export function hasParentData(restaurant: RestaurantMapEntry) {
  return (
    restaurant.ttf.sample_size > 0 ||
    restaurant.attribute_rating_count > 0 ||
    restaurant.note_count > 0
  );
}

export function hasFastStarterData(restaurant: RestaurantMapEntry) {
  return (
    restaurant.ttf.sample_size > 0 &&
    restaurant.ttf.median_minutes !== null &&
    restaurant.ttf.median_minutes <= 10
  );
}

export function matchesScoutFilter(restaurant: RestaurantMapEntry, filter: ScoutFilter) {
  if (filter === "fast-starters") return hasFastStarterData(restaurant);
  if (filter === "parent-data") return hasParentData(restaurant);
  // Only venues someone asked us to scout count — bulk pre-seeded catalog
  // entries without a request stay out of the queue (#63).
  if (filter === "needs-data") {
    return Boolean(restaurant.scouting_requested) && !hasParentData(restaurant);
  }
  return true;
}

export function matchesExploreSearch(restaurant: RestaurantMapEntry, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (restaurant.name.toLowerCase().includes(q)) return true;
  if (restaurant.address.toLowerCase().includes(q)) return true;
  return restaurant.cuisine_tags.some((tag) => tag.toLowerCase().includes(q));
}

export function matchesBrowseFilters(
  restaurant: RestaurantMapEntry,
  city: string | null,
  zip: string | null,
  tag: string | null,
) {
  if (city && parseCityFromAddress(restaurant.address)?.toLowerCase() !== city.toLowerCase()) {
    return false;
  }
  if (zip && parseZipFromAddress(restaurant.address) !== zip) return false;
  if (tag && !restaurant.cuisine_tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
    return false;
  }
  return true;
}

function countBy<T>(items: T[], keyFn: (item: T) => string | null, minCount = 1): ExploreFacet[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function countTags(restaurants: RestaurantMapEntry[]): ExploreFacet[] {
  const counts = new Map<string, number>();
  for (const restaurant of restaurants) {
    for (const raw of restaurant.cuisine_tags) {
      const tag = raw.toLowerCase();
      if (GENERIC_TAGS.has(tag)) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: tagLabel(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildExploreFacets(restaurants: RestaurantMapEntry[]) {
  return {
    cities: countBy(restaurants, (r) => parseCityFromAddress(r.address)),
    zips: countBy(restaurants, (r) => parseZipFromAddress(r.address)),
    tags: countTags(restaurants),
  };
}

export function filterExploreRestaurants(
  restaurants: RestaurantMapEntry[],
  opts: {
    scoutFilter: ScoutFilter;
    query: string;
    city: string | null;
    zip: string | null;
    tag: string | null;
  },
) {
  return restaurants.filter(
    (r) =>
      matchesExploreSearch(r, opts.query) &&
      matchesBrowseFilters(r, opts.city, opts.zip, opts.tag) &&
      matchesScoutFilter(r, opts.scoutFilter),
  );
}

export const SCOUT_FILTER_LABELS: Record<ScoutFilter, string> = {
  all: "All",
  "fast-starters": "Quick starters",
  "parent-data": "Parent-rated",
  "needs-data": "Requested — needs scouting",
};

export function parseScoutFilter(value: string | null): ScoutFilter {
  if (value === "fast-starters" || value === "parent-data" || value === "needs-data") {
    return value;
  }
  return "all";
}

export function groupRestaurantsByCity(restaurants: RestaurantMapEntry[]) {
  const groups = new Map<string, RestaurantMapEntry[]>();
  for (const restaurant of restaurants) {
    const city = parseCityFromAddress(restaurant.address) ?? "Other";
    const bucket = groups.get(city) ?? [];
    bucket.push(restaurant);
    groups.set(city, bucket);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([city, items]) => ({
      city,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}
