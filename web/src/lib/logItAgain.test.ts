import { describe, expect, it } from "vitest";

import { buildLogAgainPrefill } from "./logItAgain";
import type { UserContribution } from "../types";

function ttf(overrides: Partial<Extract<UserContribution, { kind: "ttf" }>> = {}) {
  return {
    kind: "ttf" as const,
    id: "ttf-1",
    restaurant_id: "r1",
    restaurant_name: "Test Cafe",
    submitted_at: "2026-06-01T12:00:00Z",
    elapsed_minutes: 9,
    item_type: "fries" as const,
    item_quality: 4,
    portion_size: "kid" as const,
    daypart: "lunch" as const,
    party_size_kids: 2,
    wait_context: "Busy Saturday lunch",
    ...overrides,
  };
}

function attribute(overrides: Partial<Extract<UserContribution, { kind: "attribute" }>> = {}) {
  return {
    kind: "attribute" as const,
    id: "attr-1",
    restaurant_id: "r1",
    restaurant_name: "Test Cafe",
    submitted_at: "2026-06-01T12:00:00Z",
    metric_key: "high_chair_availability",
    metric_label: "High chair availability",
    value: true,
    ...overrides,
  };
}

describe("buildLogAgainPrefill", () => {
  it("carries over party size, item type, portion, and context from the latest TTF", () => {
    const prefill = buildLogAgainPrefill([ttf()]);
    expect(prefill.partySizeKids).toBe(2);
    expect(prefill.itemType).toBe("fries");
    expect(prefill.portionSize).toBe("kid");
    expect(prefill.waitContext).toBe("Busy Saturday lunch");
  });

  it("uses the most recent TTF when multiple exist (items are submitted_at DESC)", () => {
    const prefill = buildLogAgainPrefill([
      ttf({ id: "ttf-newer", item_type: "kids_meal", party_size_kids: 1 }),
      ttf({ id: "ttf-older", item_type: "bread", party_size_kids: 3 }),
    ]);
    expect(prefill.itemType).toBe("kids_meal");
    expect(prefill.partySizeKids).toBe(1);
  });

  it("collects the latest value per attribute metric, ignoring older duplicates", () => {
    const prefill = buildLogAgainPrefill([
      attribute({ id: "attr-newer", metric_key: "noise_level", value: "moderate" }),
      attribute({ id: "attr-older", metric_key: "noise_level", value: "loud" }),
      attribute({ id: "attr-other", metric_key: "high_chair_availability", value: true }),
    ]);
    expect(prefill.ratings).toEqual({
      noise_level: "moderate",
      high_chair_availability: true,
    });
  });

  it("never surfaces TTF fields when there is no prior TTF visit", () => {
    const prefill = buildLogAgainPrefill([attribute()]);
    expect(prefill.itemType).toBeUndefined();
    expect(prefill.partySizeKids).toBeUndefined();
    expect(prefill.waitContext).toBeUndefined();
    expect(prefill.ratings).toEqual({ high_chair_availability: true });
  });

  it("returns empty ratings and undefined TTF fields for an empty history", () => {
    expect(buildLogAgainPrefill([])).toEqual({
      partySizeKids: undefined,
      itemType: undefined,
      portionSize: undefined,
      waitContext: undefined,
      ratings: {},
    });
  });
});
