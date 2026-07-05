import { describe, expect, it } from "vitest";

import { hasMatchablePreferences, matchReasonsFor } from "./familyMatch";

const EMPTY_PROFILE = {
  allergies: [],
  dietary_restrictions: [],
  cuisine_likes: [],
  cuisine_dislikes: [],
  atmosphere_preferences: [],
};

describe("hasMatchablePreferences", () => {
  it("is false when nothing is set", () => {
    expect(hasMatchablePreferences(EMPTY_PROFILE)).toBe(false);
  });

  it("is true when any single field is set", () => {
    expect(hasMatchablePreferences({ ...EMPTY_PROFILE, cuisine_likes: ["thai"] })).toBe(true);
    expect(hasMatchablePreferences({ ...EMPTY_PROFILE, allergies: ["peanut"] })).toBe(true);
  });
});

describe("matchReasonsFor", () => {
  it("returns undefined when matches haven't loaded", () => {
    expect(matchReasonsFor(null, "r1")).toBeUndefined();
  });

  it("returns undefined for a restaurant without an id", () => {
    expect(matchReasonsFor(new Map(), null)).toBeUndefined();
  });

  it("returns the reasons for a matched restaurant", () => {
    const matches = new Map([["r1", { matches: true, reasons: ["gluten-free options"] }]]);
    expect(matchReasonsFor(matches, "r1")).toEqual(["gluten-free options"]);
  });

  it("returns undefined for a restaurant with no match entry", () => {
    const matches = new Map([["r1", { matches: true, reasons: ["gluten-free options"] }]]);
    expect(matchReasonsFor(matches, "r2")).toBeUndefined();
  });
});
