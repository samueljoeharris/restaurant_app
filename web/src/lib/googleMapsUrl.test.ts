import { describe, expect, it } from "vitest";

import { googleMapsDirectionsUrl } from "./googleMapsUrl";

describe("googleMapsDirectionsUrl", () => {
  it("includes destination text when using destination_place_id", () => {
    const url = googleMapsDirectionsUrl({
      google_place_id: "ChIJtest123",
      google_maps_url: null,
      name: "Test Cafe",
      address: "100 Main St, Dedham, MA 02026, USA",
      lat: 42.24,
      lng: -71.17,
    });

    expect(url).toContain("api=1");
    expect(url).toContain("destination_place_id=ChIJtest123");
    expect(url).toContain(
      "destination=100+Main+St%2C+Dedham%2C+MA+02026%2C+USA",
    );
  });

  it("uses coordinates when place id is missing", () => {
    const url = googleMapsDirectionsUrl({
      google_place_id: null,
      google_maps_url: null,
      name: "Test Cafe",
      address: "100 Main St",
      lat: 42.24,
      lng: -71.17,
    });

    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=42.24%2C-71.17",
    );
  });

  it("adds origin when provided", () => {
    const url = googleMapsDirectionsUrl(
      {
        google_place_id: "ChIJtest123",
        google_maps_url: null,
        name: "Test Cafe",
        address: "100 Main St",
        lat: 42.24,
        lng: -71.17,
      },
      { lat: 42.1, lng: -71.2 },
    );

    expect(url).toContain("origin=42.1%2C-71.2");
  });
});
