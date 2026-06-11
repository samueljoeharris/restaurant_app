import { Link } from "react-router-dom";

import { formatTtfMedian, ttfTier, ttfTierColor } from "../lib/ttfTier";
import type { RestaurantMapEntry } from "../types";
import { Badge } from "./ui/Badge";

export function RestaurantListCard({ restaurant: r }: { restaurant: RestaurantMapEntry }) {
  const hasTtf = r.ttf.sample_size > 0;
  const hasRatings = r.attribute_rating_count > 0;
  const hasNotes = r.note_count > 0;
  const hasData = hasTtf || hasRatings || hasNotes;

  return (
    <Link to={`/restaurants/${r.id}`} className="restaurant-card">
      <div className="restaurant-card__head">
        <span className="restaurant-card__name">{r.name}</span>
        {hasTtf && (
          <span
            className="restaurant-card__ttf-dot"
            style={{ background: ttfTierColor(r.ttf) }}
            title={ttfTier(r.ttf)}
            aria-hidden
          />
        )}
      </div>
      <span className="restaurant-card__meta">{r.address}</span>
      {hasData ? (
        <div className="restaurant-card__stats">
          {hasTtf ? (
            <Badge tone={r.ttf.sample_size >= 3 ? "brand" : "neutral"}>
              Speed {formatTtfMedian(r.ttf)}
              {r.ttf.sample_size < 3 ? " · early" : ""}
            </Badge>
          ) : (
            <span className="muted small">No speed data yet</span>
          )}
          {hasRatings && (
            <Badge tone="neutral">★ {r.attribute_rating_count}</Badge>
          )}
          {hasNotes && (
            <Badge tone="neutral">💬 {r.note_count}</Badge>
          )}
        </div>
      ) : (
        <span className="restaurant-card__empty muted small">Be the first to contribute</span>
      )}
    </Link>
  );
}
