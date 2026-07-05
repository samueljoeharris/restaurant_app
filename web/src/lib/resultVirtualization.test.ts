import { describe, expect, it } from "vitest";

import { buildResultRows, shouldVirtualizeResults, VIRTUALIZE_ROW_THRESHOLD } from "./resultVirtualization";
import type { RestaurantMapEntry } from "../types";

function stubRestaurant(overrides: Partial<RestaurantMapEntry> = {}): RestaurantMapEntry {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Test Cafe",
    address: "100 Main St, Dedham, MA 02026, USA",
    lat: 42.24,
    lng: -71.17,
    cuisine_tags: ["american"],
    pilot_city: "dedham-ma",
    google_place_id: null,
    google_maps_url: null,
    ttf: { median_minutes: null, avg_quality: null, sample_size: 0, last_updated: null },
    note_count: 0,
    attribute_rating_count: 0,
    watched: false,
    ...overrides,
  };
}

describe("buildResultRows", () => {
  it("returns one card row per restaurant when not grouped", () => {
    const restaurants = [
      stubRestaurant({ id: "a", name: "A" }),
      stubRestaurant({ id: "b", name: "B" }),
    ];
    const rows = buildResultRows(restaurants, null);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.type === "card")).toBe(true);
  });

  it("interleaves a header row before each city's cards when grouped", () => {
    const restaurants = [
      stubRestaurant({ id: "a", name: "A" }),
      stubRestaurant({ id: "b", name: "B" }),
    ];
    const grouped = [
      { city: "Dedham", items: [restaurants[0]] },
      { city: "Norwood", items: [restaurants[1]] },
    ];
    const rows = buildResultRows(restaurants, grouped);
    expect(rows).toEqual([
      { type: "header", key: "city:Dedham", city: "Dedham", count: 1 },
      { type: "card", key: "a", restaurant: restaurants[0] },
      { type: "header", key: "city:Norwood", city: "Norwood", count: 1 },
      { type: "card", key: "b", restaurant: restaurants[1] },
    ]);
  });

  it("produces no rows for an empty result set", () => {
    expect(buildResultRows([], null)).toEqual([]);
    expect(buildResultRows([], [])).toEqual([]);
  });
});

describe("shouldVirtualizeResults", () => {
  it("stays off at and below the threshold", () => {
    expect(shouldVirtualizeResults(0)).toBe(false);
    expect(shouldVirtualizeResults(VIRTUALIZE_ROW_THRESHOLD)).toBe(false);
  });

  it("switches on past the threshold", () => {
    expect(shouldVirtualizeResults(VIRTUALIZE_ROW_THRESHOLD + 1)).toBe(true);
  });
});
