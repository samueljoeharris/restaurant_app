import type { RestaurantMapEntry } from "../types";
import { mapEntryKey } from "./mapEntryKey";

/**
 * Windowed rendering for the explore sidebar result list (#81).
 *
 * Kept as pure, framework-free row-building logic so it's cheap to unit
 * test; the React side (`VirtualizedResultRows`) just walks this array.
 */

/** Only worth virtualizing past this many rows — "measure first" per #81. */
export const VIRTUALIZE_ROW_THRESHOLD = 200;

export type ResultRow =
  | { type: "header"; key: string; city: string; count: number }
  | { type: "card"; key: string; restaurant: RestaurantMapEntry };

/** Flattens the grouped-by-city or flat result list into a single row array. */
export function buildResultRows(
  filtered: RestaurantMapEntry[],
  grouped: { city: string; items: RestaurantMapEntry[] }[] | null,
): ResultRow[] {
  if (!grouped) {
    return filtered.map((restaurant) => ({
      type: "card",
      key: mapEntryKey(restaurant),
      restaurant,
    }));
  }
  const rows: ResultRow[] = [];
  for (const { city, items } of grouped) {
    rows.push({ type: "header", key: `city:${city}`, city, count: items.length });
    for (const restaurant of items) {
      rows.push({ type: "card", key: mapEntryKey(restaurant), restaurant });
    }
  }
  return rows;
}

export function shouldVirtualizeResults(rowCount: number): boolean {
  return rowCount > VIRTUALIZE_ROW_THRESHOLD;
}
