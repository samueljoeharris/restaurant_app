import { useEffect, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

import { useIsMobile } from "../hooks/useBreakpoint";
import { MapMarkerLayer } from "./MapMarkerLayer";
import { PlacePracticalInfo } from "./PlacePracticalInfo";
import { WatchButton } from "./WatchButton";
import { cn } from "../lib/cn";
import { Z } from "../lib/overlayStack";
import {
  formatTtfMedian,
  ttfTier,
  TTF_TIER_COLORS,
  TTF_TIER_LABELS,
  type TtfTier,
} from "../lib/ttfTier";
import { mapEntryKey, restaurantDetailPath, restaurantSubmitPath } from "../lib/mapEntryKey";
import { mapPinFill, PIN_NOTES_COLOR, PIN_RATINGS_COLOR } from "../lib/mapPin";
import { googleMapsUrlForEntry, isGoogleOnlyEntry } from "../lib/googleMapsUrl";
import { useWatch } from "../hooks/useWatch";
import {
  MAP_ZOOM_AREA_SEARCH,
  MAP_ZOOM_VENUE_SEARCH,
  type MapSearchZoomMode,
} from "../lib/mapSearchView";
import type { RestaurantMapEntry } from "../types";
import { Badge } from "./ui/Badge";
import { Button, ButtonAnchor, ButtonLink } from "./ui/Button";
import { Stat, StatGrid } from "./ui/Stat";

const DEFAULT_MAP_CENTER = { lat: 42.2418, lng: -71.1662 };
const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
const MAPS_MAP_ID =
  import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID";

function FitBounds({
  restaurants,
  fitKey,
  skip,
  maxZoom,
}: {
  restaurants: RestaurantMapEntry[];
  fitKey: string;
  skip: boolean;
  maxZoom?: number;
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
    if (maxZoom != null && (map.getZoom() ?? 0) > maxZoom) {
      map.setZoom(maxZoom);
    }
    lastFitKeyRef.current = fitKey;
  }, [map, core, restaurants, fitKey, skip, maxZoom]);

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
  focusZoomMode = "venue",
}: {
  restaurants: RestaurantMapEntry[];
  focusId: string | null;
  focusLocation?: { lat: number; lng: number } | null;
  focusPulse?: number;
  focusZoomMode?: MapSearchZoomMode;
}) {
  const map = useMap();
  const lastAppliedRef = useRef<{ focusId: string; pulse: number } | null>(null);

  useEffect(() => {
    if (!map || !focusId) return;
    if (
      lastAppliedRef.current?.focusId === focusId &&
      lastAppliedRef.current.pulse === focusPulse
    ) {
      return;
    }
    const target = restaurants.find((r) => mapEntryKey(r) === focusId);
    const coords = target
      ? { lat: target.lat, lng: target.lng }
      : focusLocation ?? null;
    if (!coords) return;
    map.panTo(coords);
    const targetZoom =
      focusZoomMode === "area" ? MAP_ZOOM_AREA_SEARCH : MAP_ZOOM_VENUE_SEARCH;
    map.setZoom(targetZoom);
    lastAppliedRef.current = { focusId, pulse: focusPulse };
  }, [map, focusId, focusLocation, restaurants, focusPulse, focusZoomMode]);

  return null;
}

function FocusAreaCenter({
  center,
  radiusM,
  pulse = 0,
}: {
  center: { lat: number; lng: number } | null;
  radiusM: number;
  pulse?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !center) return;
    map.panTo(center);
    const zoom =
      radiusM >= 8000
        ? MAP_ZOOM_AREA_SEARCH
        : radiusM >= 4000
          ? MAP_ZOOM_AREA_SEARCH + 1
          : MAP_ZOOM_AREA_SEARCH + 2;
    map.setZoom(zoom);
  }, [map, center, radiusM, pulse]);

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
      <div className="relative h-6 w-6" aria-hidden="true">
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
  withSidebar,
  mobileLayout,
}: {
  restaurants: RestaurantMapEntry[];
  busy: boolean;
  onSearchArea: (lat: number, lng: number, radiusM: number) => void;
  withSidebar: boolean;
  mobileLayout?: boolean;
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
    <div
      className={cn(
        "pointer-events-none absolute z-[5]",
        mobileLayout
          ? "top-4 right-4 left-4 flex justify-center"
          : cn("top-4", withSidebar ? "left-[calc(min(24rem,30vw)+1rem)]" : "left-4"),
      )}
    >
      <Button
        size="sm"
        variant="secondary"
        className="pointer-events-auto rounded-full bg-surface/95 shadow-md"
        disabled={busy || !map}
        onClick={() => {
          if (!map) return;
          const center = map.getCenter();
          if (center) onSearchArea(center.lat(), center.lng(), viewportRadiusM(map));
        }}
      >
        <span className="inline-flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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

function MapLegend({
  withSidebar,
  mobileLayout,
}: {
  withSidebar: boolean;
  mobileLayout?: boolean;
}) {
  const tiers: TtfTier[] = ["fast", "ok", "slow"];
  return (
    <div
      className={cn(
        "absolute flex flex-wrap items-center gap-2 rounded-md bg-surface/92 px-3 py-2 text-xs shadow-sm",
        mobileLayout
          ? "top-4 right-4 max-w-[calc(100%-2rem)] justify-end"
          : cn(
              "bottom-4 max-w-[min(36rem,calc(100%-var(--map-panel-width)-2rem))]",
              withSidebar ? "left-[calc(min(24rem,30vw)+1rem)]" : "left-4",
            ),
      )}
      aria-label="Map pin legend"
    >
      <span className="mr-1 font-semibold">Speed tier</span>
      {tiers.map((tier) => (
        <span key={tier} className="inline-flex items-center gap-[0.35rem]">
          <span
            className="map-legend-swatch"
            style={{ background: TTF_TIER_COLORS[tier] }}
          />
          {TTF_TIER_LABELS[tier]}
        </span>
      ))}
      <span className="inline-flex items-center gap-[0.35rem]">
        <span className="map-legend-swatch map-legend-swatch--dashed" />
        1–2 visits
      </span>
      <span className="inline-flex items-center gap-[0.35rem]">
        <span className="map-legend-swatch" style={{ background: PIN_RATINGS_COLOR }} />
        Ratings
      </span>
      <span className="inline-flex items-center gap-[0.35rem]">
        <span className="map-legend-swatch" style={{ background: PIN_NOTES_COLOR }} />
        Notes
      </span>
      <span className="inline-flex items-center gap-[0.35rem]">
        <span
          className="map-legend-swatch"
          style={{ background: TTF_TIER_COLORS.unknown }}
        />
        No data
      </span>
    </div>
  );
}

function MapRestaurantSheet({
  entry,
  onClose,
  mobileLayout,
}: {
  entry: RestaurantMapEntry;
  onClose: () => void;
  mobileLayout?: boolean;
}) {
  const tier = ttfTier(entry.ttf);
  const hasTtf = entry.ttf.sample_size > 0;
  const confirmedTtf = entry.ttf.sample_size >= 3;
  const googleOnly = isGoogleOnlyEntry(entry);
  const googleMapsUrl = googleMapsUrlForEntry(entry);
  const restaurantId = entry.id ?? null;
  const { watched, busy, toggle } = useWatch(restaurantId, entry.watched ?? false);

  return (
    <aside
      className={cn(
        "flex flex-col overflow-hidden bg-surface shadow-md",
        mobileLayout
          ? "absolute inset-x-0 bottom-0 max-h-[min(58dvh,28rem)] rounded-t-xl border border-b-0 border-border"
          : "absolute top-4 right-4 bottom-4 z-[3] min-h-72 w-[var(--map-panel-width)] rounded-lg",
      )}
      style={
        mobileLayout
          ? { zIndex: Z.mapSheet + 1 }
          : undefined
      }
      aria-label={`${entry.name} map details`}
    >
      <div
        className={cn(
          "absolute top-0 bottom-0 left-0 w-1",
          mobileLayout ? "rounded-tl-xl" : "rounded-l-lg",
        )}
        style={{ background: mapPinFill(entry) }}
        aria-hidden
      />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-3 pl-[calc(1rem+4px)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={cn("m-0 leading-tight", mobileLayout ? "text-xl" : "text-2xl")}>
              {entry.name}
            </h2>
            <p className="mt-2 text-sm leading-normal text-text-muted">{entry.address}</p>
            {googleOnly && (
              <Badge variant="brand">Found on Google Maps · scout it in Little Scout</Badge>
            )}
            {entry.cuisine_tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.cuisine_tags.map((tag) => (
                  <Badge key={tag} variant="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-bg text-xl leading-none text-text-muted hover:text-text"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <PlacePracticalInfo target={entry} compact />

        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-xs font-semibold tracking-wide text-text-muted uppercase">
            Kid food speed
          </h3>
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
              <p className="m-0 flex items-center gap-2 text-sm text-text-muted">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
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
            <p className="m-0 rounded-md bg-bg p-3 text-sm text-text-muted">
              No fries timer yet — be the first parent to clock a visit.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {restaurantId && (
              <WatchButton watched={watched} busy={busy} onClick={() => void toggle()} size="sm" />
            )}
            {entry.ttf.sample_size === 0 && (
              <ButtonLink to={restaurantSubmitPath(entry)} size="sm">
                Log visit
              </ButtonLink>
            )}
          </div>
        </section>
      </div>

      <div className="shrink-0 border-t border-border bg-surface px-4 pt-3 pb-4">
        <ButtonLink to={restaurantDetailPath(entry)} fullWidth>
          {googleOnly ? "Scout this place" : "View full details"}
        </ButtonLink>
        {entry.ttf.sample_size === 0 && (
          <ButtonLink to={restaurantSubmitPath(entry)} fullWidth variant="secondary">
            Log a visit
          </ButtonLink>
        )}
        {googleMapsUrl && (
          <ButtonAnchor href={googleMapsUrl} target="_blank" rel="noreferrer" variant="ghost" fullWidth>
            View on Google Maps
          </ButtonAnchor>
        )}
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
  popInKeys,
  searchFocusId = null,
  focusZoomMode = null,
  areaCenter = null,
  areaRadiusM,
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
  popInKeys?: ReadonlySet<string>;
  searchFocusId?: string | null;
  focusZoomMode?: MapSearchZoomMode | null;
  /** Radius-mode center when browsing an area without a venue focus. */
  areaCenter?: { lat: number; lng: number } | null;
  areaRadiusM?: number;
}) {
  useMapsLibrary("marker");
  const isMobile = useIsMobile();
  const mobileLayout = isMobile;
  const sheetEntry = selectedId ? restaurants.find((r) => mapEntryKey(r) === selectedId) : null;

  if (!MAPS_KEY) {
    return (
      <div className="p-5">
        <p className="text-sm font-semibold text-error">
          Map unavailable — set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env.local</code>.
        </p>
        <p className="text-sm text-text-muted">
          Enable Maps JavaScript API and restrict the key to your dev host + Cloud Run URL.
        </p>
      </div>
    );
  }

  if (error) {
    return <p className="p-5 text-sm font-semibold text-error">{error}</p>;
  }

  const showLoadingOverlay = loading && restaurants.length === 0;

  return (
    <APIProvider apiKey={MAPS_KEY}>
      <div className="relative h-full">
        {showLoadingOverlay && (
          <div
            className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2 bg-surface/70"
            aria-live="polite"
          >
            <span className="map-loading-overlay__spinner h-7 w-7" aria-hidden="true" />
            <span className="text-sm text-text-muted">Loading map…</span>
          </div>
        )}
        <Map
          defaultCenter={DEFAULT_MAP_CENTER}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          mapId={MAPS_MAP_ID}
          className="h-full w-full"
        >
          <FitBounds
            restaurants={restaurants}
            fitKey={fitKey}
            skip={!!focusId || !!userLocation || !!cameraTarget || !!areaCenter}
            maxZoom={focusZoomMode === "area" || areaCenter ? MAP_ZOOM_AREA_SEARCH + 1 : undefined}
          />
          {focusId ? (
            <FocusRestaurant
              restaurants={restaurants}
              focusId={focusId}
              focusLocation={focusLocation}
              focusPulse={focusPulse}
              focusZoomMode={focusZoomMode ?? "venue"}
            />
          ) : areaCenter ? (
            <FocusAreaCenter
              center={areaCenter}
              radiusM={areaRadiusM ?? DEFAULT_SEARCH_RADIUS_M}
              pulse={focusPulse}
            />
          ) : null}
          <PanToLocation location={userLocation ?? cameraTarget} />
          {userLocation && <UserLocationMarker location={userLocation} />}
          {onViewportChange && (
            <ViewportWatcher onViewportChange={onViewportChange} />
          )}
          <MapMarkerLayer
            restaurants={restaurants}
            selectedId={selectedId}
            searchFocusId={searchFocusId}
            popInKeys={popInKeys}
            onSelect={(id) => onSelectChange(id)}
          />
        </Map>

        <MapLegend withSidebar={withSidebar} mobileLayout={mobileLayout} />

        {onSearchArea && (
          <SearchArea
            restaurants={restaurants}
            busy={searchBusy}
            onSearchArea={onSearchArea}
            withSidebar={withSidebar}
            mobileLayout={mobileLayout}
          />
        )}

        {selectedId && sheetEntry && (
          <MapRestaurantSheet
            entry={sheetEntry}
            onClose={() => onSelectChange(null)}
            mobileLayout={mobileLayout}
          />
        )}

        {selectedId && !sheetEntry && (
          <aside
            className={cn(
              "absolute z-[3] flex flex-col overflow-hidden bg-surface shadow-md",
              mobileLayout
                ? "inset-x-0 max-h-48 rounded-t-xl border border-b-0 border-border"
                : "top-4 right-4 bottom-4 min-h-72 w-[var(--map-panel-width)] rounded-lg",
            )}
            style={
              mobileLayout
                ? { zIndex: Z.mapSheet + 1 }
                : undefined
            }
            aria-busy="true"
            aria-label="Loading restaurant"
          >
            <div className="grid min-h-32 flex-1 place-items-center overflow-y-auto px-4 py-4">
              <p className="text-text-muted">Loading restaurant…</p>
            </div>
          </aside>
        )}
      </div>
    </APIProvider>
  );
}
