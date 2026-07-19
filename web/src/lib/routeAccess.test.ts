import { describe, expect, it } from "vitest";

import { isContributionRoute, isPublicRoute } from "./routeAccess";

describe("isContributionRoute", () => {
  it("flags submit/rate/review routes", () => {
    expect(isContributionRoute("/restaurants/abc/submit")).toBe(true);
    expect(isContributionRoute("/restaurants/abc/rate")).toBe(true);
    expect(isContributionRoute("/restaurants/place/xyz/review")).toBe(true);
    expect(isContributionRoute("/account/contributions/ttf/abc/edit")).toBe(true);
  });

  it("does not flag plain browse/detail routes", () => {
    expect(isContributionRoute("/map")).toBe(false);
    expect(isContributionRoute("/restaurants/abc")).toBe(false);
  });
});

describe("isPublicRoute", () => {
  it("allows the map and legacy /restaurants routes", () => {
    expect(isPublicRoute("/map")).toBe(true);
    expect(isPublicRoute("/restaurants")).toBe(true);
  });

  it("allows a catalog restaurant detail route", () => {
    expect(isPublicRoute("/restaurants/00000000-0000-4000-8000-000000000001")).toBe(true);
  });

  it("keeps Google-Place detail routes gated (needs an authed Places resolve)", () => {
    expect(isPublicRoute("/restaurants/place/ChIJabc123")).toBe(false);
  });

  it("keeps contribution routes gated even under a public prefix", () => {
    expect(isPublicRoute("/restaurants/abc/submit")).toBe(false);
    expect(isPublicRoute("/restaurants/abc/rate")).toBe(false);
    expect(isPublicRoute("/restaurants/place/xyz/review")).toBe(false);
  });

  it("keeps everything else gated (Saved, You, login)", () => {
    expect(isPublicRoute("/saved")).toBe(false);
    expect(isPublicRoute("/account")).toBe(false);
    expect(isPublicRoute("/account/contributions")).toBe(false);
  });
});
