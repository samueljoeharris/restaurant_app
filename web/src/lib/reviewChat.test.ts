import { describe, expect, it } from "vitest";

import { draftReadinessLabel, draftReadinessTier } from "./reviewChat";
import type { ContributionPreviewResponse } from "../types";

function stubPreview(overrides: Partial<ContributionPreviewResponse> = {}): ContributionPreviewResponse {
  return {
    valid: false,
    errors: [],
    missing_required: [],
    draft: {},
    ready_to_submit: false,
    ...overrides,
  };
}

describe("draftReadinessTier", () => {
  it("is empty when no extraction has run yet", () => {
    expect(draftReadinessTier(null)).toBe("empty");
  });

  it("is ready when the preview says ready_to_submit", () => {
    expect(draftReadinessTier(stubPreview({ ready_to_submit: true }))).toBe("ready");
  });

  it("is pending when a draft exists but isn't ready", () => {
    expect(draftReadinessTier(stubPreview({ missing_required: ["ttf.elapsed_minutes"] }))).toBe("pending");
  });
});

describe("draftReadinessLabel", () => {
  it("reads 'Your draft' before any extraction", () => {
    expect(draftReadinessLabel(null)).toBe("Your draft");
  });

  it("reads 'Ready' once ready_to_submit is true", () => {
    expect(draftReadinessLabel(stubPreview({ ready_to_submit: true, missing_required: [] }))).toBe("Ready");
  });

  it("counts missing_required entries as 'N to add'", () => {
    expect(
      draftReadinessLabel(
        stubPreview({ missing_required: ["ttf.elapsed_minutes", "ttf.item_type"] }),
      ),
    ).toBe("2 to add");
  });

  it("falls back to 'Needs attention' when pending with nothing missing (e.g. validation errors only)", () => {
    expect(
      draftReadinessLabel(stubPreview({ missing_required: [], errors: ["bad value"] })),
    ).toBe("Needs attention");
  });
});
