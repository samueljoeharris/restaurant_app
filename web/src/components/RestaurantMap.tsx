import { useEffect, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

import {
  formatTtfMedian,
  ttfTier,
  ttfTierColor,
  TTF_TIER_COLORS,
  TTF_TIER_LABELS,
  type TtfTier,
} from "../lib/ttfTier";
import type { RestaurantMapEntry } from "../types";
import { Badge } from "./ui/Badge";
import { ButtonLink } from "./ui/Button";

const DEDHAM_CENTER = { lat: 42.2418, lng: -71.1662 };
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";

function FitBounds({
  restaurants,
  skip,
}: {
  restaurants: RestaurantMapEntry[];
  skip: boolean;
}) {
  const map = useMap();
  const core = useMapsLibrary("core");

  useEffect(() => {
    if (skip || !map || !core || restaurants.length === 0) return;
    const bounds = new core.LatLngBounds();
    for (const r of restaurants) {
      bounds.extend({ lat: r.lat, lng: r.lng });
    }
    map.fitBounds(bounds, { top: 48, right: 24, bottom: 24, left: 24 });
  }, [map, core, restaurants, skip]);

  return null;
}

function FocusRestaurant({
  restaurants,
  focusId,
}: {
  restaurants: RestaurantMapEntry[];
  focusId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !focusId) return;
    const target = restaurants.find((r) => r.id === focusId);
    if (!target) return;
    map.panTo({ lat: target.lat, lng: target.lng });
    map.setZoom(15);
  }, [map, focusId, restaurants]);

  return null;
}

function MapPin({
  restaurant,
  selected,
  onSelect,
}: {
  restaurant: RestaurantMapEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = ttfTierColor(restaurant.ttf);
  const scale = selected ? 1.25 : 1;

  return (
    <AdvancedMarker
      position={{ lat: restaurant.lat, lng: restaurant.lng }}
      onClick={onSelect}
      title={restaurant.name}
    >
      <div
        className="map-pin"
        style={{
          background: color,
          transform: `scale(${scale})`,
          boxShadow: selected ? `0 0 0 3px ${color}55` : undefined,
        }}
      />
    </AdvancedMarker>
  );
}

function MapLegend() {
  const tiers: TtfTier[] = ["fast", "ok", "slow", "unknown"];
  return (
    <div className="map-legend" aria-label="TTF pin legend">
      {tiers.map((tier) => (
        <span key={tier} className="map-legend__item">
          <span
            className="map-legend__dot"
            style={{ background: TTF_TIER_COLORS[tier] }}
          />
          {TTF_TIER_LABELS[tier]}
        </span>
      ))}
    </div>
  );
}

export function RestaurantMap({
  restaurants,
  focusId,
  loading,
  error,
}: {
  restaurants: RestaurantMapEntry[];
  focusId: string | null;
  loading: boolean;
  error: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const selected = restaurants.find((r) => r.id === selectedId) ?? null;

  if (!MAPS_KEY) {
    return (
      <div className="map-fallback">
        <p className="error">Map unavailable — set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env.local</code>.</p>
        <p className="muted small">
          Enable Maps JavaScript API and restrict the key to your dev host + Cloud Run URL.
        </p>
      </div>
    );
  }

  if (error) {
    return <p className="error map-fallback">{error}</p>;
  }

  if (loading) {
    return <p className="muted map-fallback">Loading map…</p>;
  }

  return (
    <APIProvider apiKey={MAPS_KEY}>
      <div className="map-shell">
        <Map
          defaultCenter={DEDHAM_CENTER}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI
          mapId="DEMO_MAP_ID"
          className="map-canvas"
        >
          <FitBounds restaurants={restaurants} skip={!!focusId} />
          <FocusRestaurant restaurants={restaurants} focusId={focusId} />
          {restaurants.map((r) => (
            <MapPin
              key={r.id}
              restaurant={r}
              selected={selectedId === r.id}
              onSelect={() => setSelectedId(r.id)}
            />
          ))}
        </Map>

        <MapLegend />

        {selected && (
          <div className="map-sheet">
            <div className="map-sheet__head">
              <div>
                <h2 className="map-sheet__title">{selected.name}</h2>
                <p className="muted small">{selected.address}</p>
              </div>
              <button
                type="button"
                className="map-sheet__close"
                onClick={() => setSelectedId(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="map-sheet__stats">
              <Badge tone={ttfTier(selected.ttf) === "fast" ? "success" : ttfTier(selected.ttf) === "slow" ? "warning" : "neutral"}>
                {formatTtfMedian(selected.ttf)}
              </Badge>
              <span className="muted small">{selected.ttf.sample_size} visits</span>
            </div>
            <ButtonLink to={`/restaurants/${selected.id}`} fullWidth>
              View details
            </ButtonLink>
          </div>
        )}
      </div>
    </APIProvider>
  );
}
