import { AdvancedMarker } from "@vis.gl/react-google-maps";

import {
  mapPinFill,
  mapPinHasBadges,
  mapPinKind,
  mapPinLabel,
  mapPinTooltip,
} from "../lib/mapPin";
import type { RestaurantMapEntry } from "../types";

export function MapPin({
  restaurant,
  selected,
  popIn,
  onSelect,
}: {
  restaurant: RestaurantMapEntry;
  selected: boolean;
  popIn?: boolean;
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
          popIn ? "map-pin-wrap--pop-in" : "",
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
