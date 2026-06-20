import { AdvancedMarker } from "@vis.gl/react-google-maps";

import { cn } from "../lib/cn";
import {
  mapPinFill,
  mapPinHasBadges,
  mapPinKind,
  mapPinLabel,
  mapPinTooltip,
} from "../lib/mapPin";
import { isGoogleOnlyEntry } from "../lib/googleMapsUrl";
import type { RestaurantMapEntry } from "../types";

export function MapPin({
  restaurant,
  selected,
  searchFocus,
  popIn,
  onSelect,
}: {
  restaurant: RestaurantMapEntry;
  selected: boolean;
  searchFocus?: boolean;
  popIn?: boolean;
  onSelect: () => void;
}) {
  const kind = mapPinKind(restaurant);
  const googleOnly = isGoogleOnlyEntry(restaurant);
  const fill = mapPinFill(restaurant, { searchFocus });
  const label = mapPinLabel(restaurant);
  const tooltip = mapPinTooltip(restaurant);
  const showBadges = mapPinHasBadges(restaurant);

  return (
    <AdvancedMarker
      position={{ lat: restaurant.lat, lng: restaurant.lng }}
      onClick={onSelect}
      title={tooltip}
      zIndex={searchFocus ? 2000 : selected ? 1500 : undefined}
    >
      <div
        className={cn(
          "map-pin-wrap",
          selected && "map-pin-wrap--selected",
          searchFocus && "map-pin-wrap--search-focus",
          googleOnly && "map-pin-wrap--discover",
          popIn && "map-pin-wrap--pop-in",
          `map-pin-wrap--${kind}`,
        )}
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
          {label && !searchFocus && (
            <span className="map-pin-label" style={{ borderColor: fill }}>
              {label}
            </span>
          )}
          {searchFocus && (
            <span className="map-pin-label map-pin-label--search" style={{ borderColor: fill }}>
              ★
            </span>
          )}
          <div
            className="map-pin"
            style={{
              background: fill,
              boxShadow: searchFocus
                ? "0 0 0 4px rgb(232 93 36 / 40%), 0 2px 10px rgb(0 0 0 / 30%)"
                : selected
                  ? `0 0 0 3px ${fill}66`
                  : undefined,
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
