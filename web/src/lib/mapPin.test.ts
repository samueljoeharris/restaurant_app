import { describe, expect, it } from "vitest";

import {
  SEARCH_FOCUS_PIN_COLOR,
  mapPinBadges,
  mapPinFill,
  mapPinHasBadges,
  mapPinKind,
  mapPinLabel,
} from "./mapPin";
import { TTF_TIER_COLORS } from "./ttfTier";
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

describe("mapPinKind / mapPinFill", () => {
  it("classifies confirmed TTF (>=3 observations) and fills by tier", () => {
    const entry = stubRestaurant({
      ttf: { median_minutes: 6, avg_quality: 4, sample_size: 5, last_updated: "2026-06-01" },
    });
    expect(mapPinKind(entry)).toBe("confirmed_ttf");
    expect(mapPinFill(entry)).toBe(TTF_TIER_COLORS.fast);
  });

  it("classifies early TTF (1-2 observations) and previews the tier color", () => {
    const entry = stubRestaurant({
      ttf: { median_minutes: 20, avg_quality: 3, sample_size: 2, last_updated: "2026-06-01" },
    });
    expect(mapPinKind(entry)).toBe("early_ttf");
    // previewTtfTier: median 20 > 15 => slow, even though sample_size < 3
    expect(mapPinFill(entry)).toBe(TTF_TIER_COLORS.slow);
  });

  it("folds no-TTF-but-has-ratings/notes into the empty kind, filling as unknown", () => {
    const ratingsOnly = stubRestaurant({ attribute_rating_count: 4 });
    const notesOnly = stubRestaurant({ note_count: 2 });
    expect(mapPinKind(ratingsOnly)).toBe("empty");
    expect(mapPinKind(notesOnly)).toBe("empty");
    expect(mapPinFill(ratingsOnly)).toBe(TTF_TIER_COLORS.unknown);
    expect(mapPinFill(notesOnly)).toBe(TTF_TIER_COLORS.unknown);
  });

  it("classifies a fully empty entry as empty, filled as unknown", () => {
    const entry = stubRestaurant();
    expect(mapPinKind(entry)).toBe("empty");
    expect(mapPinFill(entry)).toBe(TTF_TIER_COLORS.unknown);
  });

  it("searchFocus overrides fill regardless of kind", () => {
    const entry = stubRestaurant({
      ttf: { median_minutes: 6, avg_quality: 4, sample_size: 5, last_updated: "2026-06-01" },
    });
    expect(mapPinFill(entry, { searchFocus: true })).toBe(SEARCH_FOCUS_PIN_COLOR);
  });
});

describe("mapPinBadges dedup — TTF minutes > ratings > notes", () => {
  it("confirmed TTF: label shows minutes, so both ratings and notes badges remain (not suppressed)", () => {
    const entry = stubRestaurant({
      ttf: { median_minutes: 6, avg_quality: 4, sample_size: 5, last_updated: "2026-06-01" },
      attribute_rating_count: 2,
      note_count: 1,
    });
    expect(mapPinLabel(entry)).toBe("6m");
    expect(mapPinBadges(entry)).toEqual({ ratings: true, notes: true });
    expect(mapPinHasBadges(entry)).toBe(true);
  });

  it("early TTF: label shows minutes, so a notes badge remains while an absent ratings badge stays false", () => {
    const entry = stubRestaurant({
      ttf: { median_minutes: 20, avg_quality: 3, sample_size: 2, last_updated: "2026-06-01" },
      attribute_rating_count: 0,
      note_count: 3,
    });
    expect(mapPinLabel(entry)).toBe("20m");
    expect(mapPinBadges(entry)).toEqual({ ratings: false, notes: true });
    expect(mapPinHasBadges(entry)).toBe(true);
  });

  it("no TTF, has ratings and notes: label shows the ratings star, suppressing the ratings badge but not notes", () => {
    const entry = stubRestaurant({ attribute_rating_count: 4, note_count: 2 });
    expect(mapPinLabel(entry)).toBe("★");
    expect(mapPinBadges(entry)).toEqual({ ratings: false, notes: true });
    expect(mapPinHasBadges(entry)).toBe(true);
  });

  it("no TTF, ratings only: label shows the star, so the ratings badge is fully suppressed", () => {
    const entry = stubRestaurant({ attribute_rating_count: 3, note_count: 0 });
    expect(mapPinLabel(entry)).toBe("★");
    expect(mapPinBadges(entry)).toEqual({ ratings: false, notes: false });
    expect(mapPinHasBadges(entry)).toBe(false);
  });

  it("no TTF, notes only: label shows the speech bubble, suppressing the notes badge", () => {
    const entry = stubRestaurant({ attribute_rating_count: 0, note_count: 5 });
    expect(mapPinLabel(entry)).toBe("💬");
    expect(mapPinBadges(entry)).toEqual({ ratings: false, notes: false });
    expect(mapPinHasBadges(entry)).toBe(false);
  });

  it("completely empty entry: no label, no badges", () => {
    const entry = stubRestaurant();
    expect(mapPinLabel(entry)).toBeNull();
    expect(mapPinBadges(entry)).toEqual({ ratings: false, notes: false });
    expect(mapPinHasBadges(entry)).toBe(false);
  });
});
