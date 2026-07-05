import { describe, expect, it } from "vitest";

import { groupContributionsIntoVisits } from "./visitGrouping";
import type { UserContribution } from "../types";

function ttf(id: string, restaurantId: string, submittedAt: string): UserContribution {
  return {
    kind: "ttf",
    id,
    restaurant_id: restaurantId,
    restaurant_name: restaurantId === "r1" ? "Test Cafe" : "Other Spot",
    submitted_at: submittedAt,
    elapsed_minutes: 9,
    item_type: "fries",
    item_quality: 4,
    portion_size: "kid",
    daypart: "lunch",
    party_size_kids: 2,
  };
}

function note(id: string, restaurantId: string, submittedAt: string): UserContribution {
  return {
    kind: "note",
    id,
    restaurant_id: restaurantId,
    restaurant_name: restaurantId === "r1" ? "Test Cafe" : "Other Spot",
    submitted_at: submittedAt,
    text: "Great high chairs",
    tags: [],
  };
}

describe("groupContributionsIntoVisits", () => {
  it("groups same-restaurant contributions submitted within the window into one visit", () => {
    const visits = groupContributionsIntoVisits([
      ttf("t1", "r1", "2026-06-01T12:00:00Z"),
      note("n1", "r1", "2026-06-01T12:20:00Z"),
    ]);
    expect(visits).toHaveLength(1);
    expect(visits[0].items.map((i) => i.id).sort()).toEqual(["n1", "t1"]);
  });

  it("splits contributions to the same restaurant into separate visits when far apart in time", () => {
    const visits = groupContributionsIntoVisits([
      ttf("t1", "r1", "2026-06-01T12:00:00Z"),
      ttf("t2", "r1", "2026-06-08T12:00:00Z"),
    ]);
    expect(visits).toHaveLength(2);
  });

  it("never merges contributions from different restaurants even at the same time", () => {
    const visits = groupContributionsIntoVisits([
      ttf("t1", "r1", "2026-06-01T12:00:00Z"),
      ttf("t2", "r2", "2026-06-01T12:00:00Z"),
    ]);
    expect(visits).toHaveLength(2);
    expect(visits.map((v) => v.restaurantId).sort()).toEqual(["r1", "r2"]);
  });

  it("sorts visits by most recent activity first, and is input-order independent", () => {
    const older = ttf("t-older", "r1", "2026-05-01T12:00:00Z");
    const newer = ttf("t-newer", "r2", "2026-06-01T12:00:00Z");
    const visits = groupContributionsIntoVisits([older, newer]);
    expect(visits.map((v) => v.restaurantId)).toEqual(["r2", "r1"]);
  });

  it("returns an empty list for no contributions", () => {
    expect(groupContributionsIntoVisits([])).toEqual([]);
  });
});
