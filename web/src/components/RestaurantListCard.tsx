import { forwardRef } from "react";
import { Link } from "react-router-dom";

import { cn } from "../lib/cn";
import { restaurantDetailPath } from "../lib/mapEntryKey";
import { formatTtfMedian, ttfTier, ttfTierColor } from "../lib/ttfTier";
import type { RestaurantMapEntry } from "../types";
import { Badge } from "./ui/Badge";

const cardClassName =
  "grid gap-1 rounded-md border border-border bg-surface p-4 shadow-sm transition-[border-color,transform,box-shadow] duration-fast ease-out hover:-translate-y-px hover:border-brand/40 hover:shadow-md";

interface RestaurantListCardProps {
  restaurant: RestaurantMapEntry;
  /** When provided, the card focuses the entry on the map instead of navigating to detail. */
  onSelect?: () => void;
  /** Highlights the card when it matches the active map selection. */
  active?: boolean;
}

export const RestaurantListCard = forwardRef<HTMLElement, RestaurantListCardProps>(
  function RestaurantListCard({ restaurant: r, onSelect, active = false }, ref) {
    const hasTtf = r.ttf.sample_size > 0;
    const hasRatings = r.attribute_rating_count > 0;
    const hasNotes = r.note_count > 0;
    const hasData = hasTtf || hasRatings || hasNotes;

    const className = cn(
      cardClassName,
      active && "border-brand shadow-[0_0_0_2px_var(--color-brand-soft)]",
    );

    const body = (
      <>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-bold">{r.name}</span>
          {hasTtf && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: ttfTierColor(r.ttf) }}
              title={ttfTier(r.ttf)}
              aria-hidden
            />
          )}
        </div>
        <span className="text-sm text-text-muted">{r.address}</span>
        {hasData ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {hasTtf ? (
              <Badge variant={r.ttf.sample_size >= 3 ? "brand" : "neutral"}>
                Speed {formatTtfMedian(r.ttf)}
                {r.ttf.sample_size < 3 ? " · early" : ""}
              </Badge>
            ) : (
              <span className="text-sm text-text-muted">No speed data yet</span>
            )}
            {hasRatings && (
              <Badge variant="neutral">★ {r.attribute_rating_count}</Badge>
            )}
            {hasNotes && (
              <Badge variant="neutral">💬 {r.note_count}</Badge>
            )}
          </div>
        ) : (
          <span className="mt-2 block text-sm text-text-muted">Be the first to contribute</span>
        )}
      </>
    );

    if (onSelect) {
      return (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          type="button"
          className={cn(
            className,
            "w-full cursor-pointer appearance-none text-left font-[inherit] text-inherit",
          )}
          aria-pressed={active}
          onClick={onSelect}
        >
          {body}
        </button>
      );
    }

    return (
      <Link ref={ref as React.Ref<HTMLAnchorElement>} to={restaurantDetailPath(r)} className={className}>
        {body}
      </Link>
    );
  },
);
