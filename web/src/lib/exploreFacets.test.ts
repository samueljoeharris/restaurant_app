import { describe, expect, it } from "vitest";

import {
  buildExploreFacets,
  filterExploreRestaurants,
  matchesBrowseFilters,
  matchesScoutFilter,
  parseScoutFilter,
  parseZipFromAddress,
} from "./exploreFacets";
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

describe("exploreFacets", () => {
  it("parseScoutFilter round-trips known filters", () => {
    expect(parseScoutFilter("fast-starters")).toBe("fast-starters");
    expect(parseScoutFilter("parent-data")).toBe("parent-data");
    expect(parseScoutFilter("needs-data")).toBe("needs-data");
    expect(parseScoutFilter(null)).toBe("all");
    expect(parseScoutFilter("bogus")).toBe("all");
  });

  it("buildExploreFacets groups city and zip from addresses", () => {
    const restaurants = [
      stubRestaurant(),
      stubRestaurant({
        id: "00000000-0000-4000-8000-000000000002",
        address: "200 Oak Ave, Dedham, MA 02026, USA",
      }),
      stubRestaurant({
        id: "00000000-0000-4000-8000-000000000003",
        address: "50 Elm St, Norwood, MA 02062, USA",
      }),
    ];
    const facets = buildExploreFacets(restaurants);
    expect(facets.cities.find((c) => c.key === "Dedham")?.count).toBe(2);
    expect(facets.zips.find((z) => z.key === "02026")?.count).toBe(2);
    expect(parseZipFromAddress(restaurants[0].address)).toBe("02026");
  });

  it("needs-data only matches scout-requested venues without parent data", () => {
    const bulkSeeded = stubRestaurant();
    const requested = stubRestaurant({
      id: "00000000-0000-4000-8000-000000000002",
      scouting_requested: true,
    });
    const requestedAndScouted = stubRestaurant({
      id: "00000000-0000-4000-8000-000000000003",
      scouting_requested: true,
      note_count: 1,
    });
    expect(matchesScoutFilter(bulkSeeded, "needs-data")).toBe(false);
    expect(matchesScoutFilter(requested, "needs-data")).toBe(true);
    expect(matchesScoutFilter(requestedAndScouted, "needs-data")).toBe(false);
  });

  it("filterExploreRestaurants applies scout and browse params", () => {
    const restaurants = [
      stubRestaurant({
        ttf: { median_minutes: 8, avg_quality: 4, sample_size: 2, last_updated: null },
        attribute_rating_count: 1,
      }),
      stubRestaurant({
        id: "00000000-0000-4000-8000-000000000002",
        address: "50 Elm St, Norwood, MA 02062, USA",
      }),
    ];
    const filtered = filterExploreRestaurants(restaurants, {
      scoutFilter: "parent-data",
      query: "",
      city: "Dedham",
      zip: null,
      tag: null,
    });
    expect(filtered).toHaveLength(1);
    expect(matchesScoutFilter(restaurants[0], "fast-starters")).toBe(true);
    expect(matchesBrowseFilters(restaurants[1], "Dedham", null, null)).toBe(false);
  });
});
