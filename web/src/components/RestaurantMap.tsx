import { useEffect, useState } from "react";
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
import { ButtonLink } from "./ui/Button";
import { Stat, StatGrid } from "./ui/Stat";

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

  useEffect(() => {
    if (focusId) setSelectedId(focusId);
  }, [focusId]);

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
          <MapRestaurantSheet
            entry={selected}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </APIProvider>
  );
}
