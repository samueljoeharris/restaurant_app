import { useEffect, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

import {
  mapPinFill,
  mapPinHasBadges,
  mapPinKind,
  mapPinLabel,
  mapPinTooltip,
} from "../lib/mapPin";
import {
  formatTtfMedian,
  ttfTier,
  TTF_TIER_COLORS,
  TTF_TIER_LABELS,
  type TtfTier,
} from "../lib/ttfTier";
import type { RestaurantMapEntry } from "../types";
import { Badge } from "./ui/Badge";
import { Button, ButtonLink } from "./ui/Button";
import { Stat, StatGrid } from "./ui/Stat";

const DEFAULT_MAP_CENTER = { lat: 42.2418, lng: -71.1662 };
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";

function FitBounds({
  restaurants,
  fitKey,
  skip,
}: {
  restaurants: RestaurantMapEntry[];
  fitKey: string;
  skip: boolean;
}) {
  const map = useMap();
  const core = useMapsLibrary("core");
  const lastFitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (skip || !map || !core || restaurants.length === 0) return;
    if (lastFitKeyRef.current === fitKey) return;
    const bounds = new core.LatLngBounds();
    for (const r of restaurants) {
      bounds.extend({ lat: r.lat, lng: r.lng });
    }
    map.fitBounds(bounds, { top: 48, right: 24, bottom: 24, left: 24 });
    lastFitKeyRef.current = fitKey;
  }, [map, core, restaurants, fitKey, skip]);

  return null;
}

function ViewportWatcher({
  onViewportChange,
}: {
  onViewportChange: (bbox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const handle = () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      onViewportChange({
        minLat: sw.lat(),
        maxLat: ne.lat(),
        minLng: sw.lng(),
        maxLng: ne.lng(),
      });
    };
    const listener = map.addListener("idle", handle);
    return () => listener.remove();
  }, [map, onViewportChange]);

  return null;
}

function FocusRestaurant({
  restaurants,
  focusId,
  focusLocation,
  focusPulse = 0,
}: {
  restaurants: RestaurantMapEntry[];
  focusId: string | null;
  focusLocation?: { lat: number; lng: number } | null;
  focusPulse?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !focusId) return;
    const target = restaurants.find((r) => r.id === focusId);
    const coords = target
      ? { lat: target.lat, lng: target.lng }
      : focusLocation ?? null;
    if (!coords) return;
    map.panTo(coords);
    const zoom = map.getZoom() ?? 13;
    if (zoom < 15) map.setZoom(15);
  }, [map, focusId, focusLocation, restaurants, focusPulse]);

  return null;
}

function PanToLocation({ location }: { location: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !location) return;
    map.panTo(location);
    const zoom = map.getZoom() ?? 13;
    if (zoom < 14) map.setZoom(14);
  }, [map, location]);

  return null;
}

function UserLocationMarker({ location }: { location: { lat: number; lng: number } }) {
  return (
    <AdvancedMarker position={location} zIndex={1000}>
      <div className="map-user-location" aria-hidden="true">
        <span className="map-user-location__dot" />
        <span className="map-user-location__pulse" />
      </div>
    </AdvancedMarker>
  );
}

const MIN_SEARCH_RADIUS_M = 1000;
const MAX_SEARCH_RADIUS_M = 25000;
const DEFAULT_SEARCH_RADIUS_M = 8000;
const SPARSE_VIEWPORT_MAX = 3;

function viewportRadiusM(map: google.maps.Map): number {
  const bounds = map.getBounds();
  const center = map.getCenter();
  if (!bounds || !center) return DEFAULT_SEARCH_RADIUS_M;
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const halfLatM = (Math.abs(ne.lat() - sw.lat()) * 111_320) / 2;
  const halfLngM =
    (Math.abs(ne.lng() - sw.lng()) * 111_320 * Math.cos((center.lat() * Math.PI) / 180)) / 2;
  const radius = Math.min(halfLatM, halfLngM);
  return Math.round(
    Math.max(MIN_SEARCH_RADIUS_M, Math.min(MAX_SEARCH_RADIUS_M, radius)),
  );
}

function countWithinBounds(
  map: google.maps.Map,
  restaurants: RestaurantMapEntry[],
): number {
  const bounds = map.getBounds();
  if (!bounds) return restaurants.length;
  let count = 0;
  for (const r of restaurants) {
    if (bounds.contains({ lat: r.lat, lng: r.lng })) count += 1;
  }
  return count;
}

function SearchArea({
  restaurants,
  busy,
  onSearchArea,
}: {
  restaurants: RestaurantMapEntry[];
  busy: boolean;
  onSearchArea: (lat: number, lng: number, radiusM: number) => void;
}) {
  const map = useMap();
  const [sparse, setSparse] = useState(false);

  useEffect(() => {
    if (!map) return;
    const update = () =>
      setSparse(countWithinBounds(map, restaurants) <= SPARSE_VIEWPORT_MAX);
    const listener = map.addListener("idle", update);
    update();
    return () => listener.remove();
  }, [map, restaurants]);

  if (!sparse) return null;

  return (
    <div className="map-search-area">
      <Button
        size="sm"
        variant="secondary"
        className="map-search-area__button"
        disabled={busy || !map}
        onClick={() => {
          if (!map) return;
          const center = map.getCenter();
          if (center) onSearchArea(center.lat(), center.lng(), viewportRadiusM(map));
        }}
      >
        <span className="map-search-area__label">
          <svg className="map-search-area__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z"
            />
          </svg>
          {busy ? "Searching…" : "Search this area"}
        </span>
      </Button>
    </div>
  );
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
  const kind = mapPinKind(restaurant);
  const fill = mapPinFill(restaurant);
  const label = mapPinLabel(restaurant);
  const tooltip = mapPinTooltip(restaurant);
  const showBadges = mapPinHasBadges(restaurant);

  return (
    <AdvancedMarker
      position={{ lat: restaurant.lat, lng: restaurant.lng }}
      onClick={onSelect}
      title={tooltip}
    >
      <div
        className={[
          "map-pin-wrap",
          selected ? "map-pin-wrap--selected" : "",
          `map-pin-wrap--${kind}`,
        ].join(" ")}
        aria-label={tooltip.replace(/\n/g, ". ")}
      >
        <div className="map-pin-tooltip" role="tooltip">
          {tooltip.split("\n").map((line, i) => (
            <span key={i}>
              {line}
              {i < tooltip.split("\n").length - 1 && <br />}
            </span>
          ))}
        </div>
        <div className="map-pin-stack">
          {label && (
            <span className="map-pin-label" style={{ borderColor: fill }}>
              {label}
            </span>
          )}
          <div
            className="map-pin"
            style={{
              background: fill,
              boxShadow: selected ? `0 0 0 3px ${fill}66` : undefined,
            }}
          />
          {showBadges && (
            <div className="map-pin-badges">
              {restaurant.attribute_rating_count > 0 && kind !== "ratings" && (
                <span className="map-pin-badge" title="Parent ratings">
                  ★
                </span>
              )}
              {restaurant.note_count > 0 && kind !== "notes" && (
                <span className="map-pin-badge" title="Parent notes">
                  💬
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </AdvancedMarker>
  );
}

function MapLegend() {
  const tiers: TtfTier[] = ["fast", "ok", "slow"];
  return (
    <div className="map-legend" aria-label="Map pin legend">
      <span className="map-legend__heading">Speed tier</span>
      {tiers.map((tier) => (
        <span key={tier} className="map-legend__item">
          <span
            className="map-legend__dot"
            style={{ background: TTF_TIER_COLORS[tier] }}
          />
          {TTF_TIER_LABELS[tier]}
        </span>
      ))}
      <span className="map-legend__item">
        <span className="map-legend__dot map-legend__dot--dashed" />
        1–2 visits
      </span>
      <span className="map-legend__item">
        <span className="map-legend__dot" style={{ background: "#7c6fe0" }} />
        Ratings
      </span>
      <span className="map-legend__item">
        <span className="map-legend__dot" style={{ background: "#4a90d9" }} />
        Notes
      </span>
      <span className="map-legend__item">
        <span className="map-legend__dot" style={{ background: TTF_TIER_COLORS.unknown }} />
        No data
      </span>
    </div>
  );
}

function MapRestaurantSheet({
  entry,
  onClose,
}: {
  entry: RestaurantMapEntry;
  onClose: () => void;
}) {
  const kind = mapPinKind(entry);
  const tier = ttfTier(entry.ttf);
  const hasTtf = entry.ttf.sample_size > 0;
  const confirmedTtf = entry.ttf.sample_size >= 3;

  return (
    <aside className="map-sheet" aria-label={`${entry.name} map details`}>
      <div
        className="map-sheet__accent"
        style={{ background: mapPinFill(entry) }}
        aria-hidden
      />
      <div className="map-sheet__scroll">
        <div className="map-sheet__head">
          <div className="map-sheet__intro">
            <h2 className="map-sheet__title">{entry.name}</h2>
            <p className="map-sheet__address">{entry.address}</p>
            {entry.cuisine_tags.length > 0 && (
              <div className="map-sheet__tags">
                {entry.cuisine_tags.map((tag) => (
                  <Badge key={tag} tone="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="map-sheet__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <section className="map-sheet__section">
          <h3 className="map-sheet__section-title">Kid food speed</h3>
          {hasTtf ? (
            <>
              <StatGrid>
                <Stat
                  label="Median"
                  value={formatTtfMedian(entry.ttf)}
                  highlight={confirmedTtf}
                />
                <Stat
                  label="Quality"
                  value={entry.ttf.avg_quality?.toFixed(1) ?? "—"}
                />
                <Stat
                  label="Visits"
                  value={entry.ttf.sample_size}
                  hint={confirmedTtf ? undefined : "need 3 for tier"}
                />
              </StatGrid>
              <p className="map-sheet__tier">
                <span
                  className="map-sheet__tier-dot"
                  style={{
                    background: confirmedTtf
                      ? TTF_TIER_COLORS[tier]
                      : TTF_TIER_COLORS[previewTtfTierFromEntry(entry)],
                  }}
                />
                {confirmedTtf
                  ? TTF_TIER_LABELS[tier]
                  : `Early signal — ${entry.ttf.sample_size} visit${entry.ttf.sample_size === 1 ? "" : "s"} logged`}
              </p>
            </>
          ) : (
            <p className="map-sheet__empty">No fries timer yet — be the first parent to clock a visit.</p>
          )}
        </section>

        <section className="map-sheet__section">
          <h3 className="map-sheet__section-title">Parent contributions</h3>
          <StatGrid>
            <Stat
              label="Ratings"
              value={entry.attribute_rating_count}
              hint={entry.attribute_rating_count === 0 ? "none yet" : "submissions"}
            />
            <Stat
              label="Notes"
              value={entry.note_count}
              hint={entry.note_count === 0 ? "none yet" : "from parents"}
            />
            <Stat
              label="Data"
              value={
                kind === "empty"
                  ? "—"
                  : kind === "confirmed_ttf"
                    ? "Speed"
                    : kind === "early_ttf"
                      ? "Early"
                      : kind === "ratings"
                        ? "★"
                        : "💬"
              }
              hint="primary signal"
            />
          </StatGrid>
        </section>
      </div>

      <div className="map-sheet__actions">
        <ButtonLink to={`/restaurants/${entry.id}`} fullWidth>
          View full details
        </ButtonLink>
      </div>
    </aside>
  );
}

function previewTtfTierFromEntry(entry: RestaurantMapEntry): TtfTier {
  const median = entry.ttf.median_minutes;
  if (median === null) return "unknown";
  if (median <= 8) return "fast";
  if (median <= 15) return "ok";
  return "slow";
}

export function RestaurantMap({
  restaurants,
  focusId,
  focusLocation = null,
  focusPulse = 0,
  selectedId,
  onSelectChange,
  loading,
  error,
  searchBusy = false,
  userLocation = null,
  cameraTarget = null,
  withSidebar = false,
  fitKey = "all",
  onSearchArea,
  onViewportChange,
}: {
  restaurants: RestaurantMapEntry[];
  focusId: string | null;
  focusLocation?: { lat: number; lng: number } | null;
  focusPulse?: number;
  selectedId: string | null;
  onSelectChange: (id: string | null) => void;
  loading: boolean;
  error: string | null;
  searchBusy?: boolean;
  userLocation?: { lat: number; lng: number } | null;
  cameraTarget?: { lat: number; lng: number } | null;
  withSidebar?: boolean;
  fitKey?: string;
  onSearchArea?: (lat: number, lng: number, radiusM: number) => void;
  onViewportChange?: (bbox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }) => void;
}) {
  const sheetEntry = selectedId ? restaurants.find((r) => r.id === selectedId) : null;

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

  if (loading && restaurants.length === 0) {
    return <p className="muted map-fallback">Loading map…</p>;
  }

  return (
    <APIProvider apiKey={MAPS_KEY}>
      <div className={`map-shell${withSidebar ? " map-shell--with-sidebar" : ""}`}>
        <Map
          defaultCenter={DEFAULT_MAP_CENTER}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI
          mapId="DEMO_MAP_ID"
          className="map-canvas"
        >
          <FitBounds
            restaurants={restaurants}
            fitKey={fitKey}
            skip={!!focusId || !!userLocation || !!cameraTarget}
          />
          <FocusRestaurant
            restaurants={restaurants}
            focusId={focusId}
            focusLocation={focusLocation}
            focusPulse={focusPulse}
          />
          <PanToLocation location={userLocation ?? cameraTarget} />
          {userLocation && <UserLocationMarker location={userLocation} />}
          {onViewportChange && (
            <ViewportWatcher onViewportChange={onViewportChange} />
          )}
          {restaurants.map((r) => (
            <MapPin
              key={r.id}
              restaurant={r}
              selected={selectedId === r.id}
              onSelect={() => onSelectChange(r.id)}
            />
          ))}
        </Map>

        <MapLegend />

        {onSearchArea && (
          <SearchArea
            restaurants={restaurants}
            busy={searchBusy}
            onSearchArea={onSearchArea}
          />
        )}

        {selectedId && sheetEntry && (
          <MapRestaurantSheet entry={sheetEntry} onClose={() => onSelectChange(null)} />
        )}

        {selectedId && !sheetEntry && (
          <aside className="map-sheet map-sheet--loading" aria-busy="true" aria-label="Loading restaurant">
            <div className="map-sheet__scroll">
              <p className="muted">Loading restaurant…</p>
            </div>
          </aside>
        )}
      </div>
    </APIProvider>
  );
}
