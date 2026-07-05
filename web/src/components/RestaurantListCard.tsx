import { forwardRef } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { useIntentPrefetch } from "../hooks/useIntentPrefetch";
import { useWatch } from "../hooks/useWatch";
import { cn } from "../lib/cn";
import { prefetchRestaurantDetail } from "../lib/detailPrefetch";
import { restaurantDetailPath } from "../lib/mapEntryKey";
import { formatTtfMedian, ttfTier, ttfTierColor } from "../lib/ttfTier";
import type { RestaurantMapEntry } from "../types";
import { WatchButton } from "./WatchButton";
import { Badge } from "./ui/Badge";

const defaultCardClassName =
  "grid gap-1 rounded-md border border-border bg-surface p-4 shadow-sm transition-[border-color,transform,box-shadow] duration-fast ease-out hover:-translate-y-px hover:border-brand/40 hover:shadow-md";

const compactCardClassName =
  "grid gap-0.5 border-b border-border/60 py-3 transition-colors duration-fast hover:bg-brand-soft/30";

interface RestaurantListCardProps {
  restaurant: RestaurantMapEntry;
  onSelect?: () => void;
  active?: boolean;
  density?: "default" | "compact";
  showWatch?: boolean;
}

export const RestaurantListCard = forwardRef<HTMLElement, RestaurantListCardProps>(
  function RestaurantListCard(
    { restaurant: r, onSelect, active = false, density = "default", showWatch = false },
    ref,
  ) {
    const hasTtf = r.ttf.sample_size > 0;
    const hasRatings = r.attribute_rating_count > 0;
    const hasNotes = r.note_count > 0;
    const hasData = hasTtf || hasRatings || hasNotes;
    const restaurantId = r.id ?? null;
    const watch = useWatch(restaurantId, r.watched ?? false);
    const { idToken } = useAuth();
    const intentProps = useIntentPrefetch(() => prefetchRestaurantDetail(r, idToken));

    const className = cn(
      density === "compact" ? compactCardClassName : defaultCardClassName,
      active && density === "default" && "border-brand shadow-[0_0_0_2px_var(--color-brand-soft)]",
      active && density === "compact" && "bg-brand-soft/40",
    );

    const body =
      density === "compact" ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold">{r.name}</span>
              {hasTtf && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: ttfTierColor(r.ttf) }}
                  aria-hidden
                />
              )}
            </div>
            <span className="mt-0.5 block truncate text-xs text-text-muted">
              {hasTtf
                ? `Speed ${formatTtfMedian(r.ttf)}${r.ttf.sample_size < 3 ? " · early" : ""}`
                : "No speed yet"}
              {hasRatings ? ` · ★${r.attribute_rating_count}` : ""}
              {hasNotes ? ` · 💬${r.note_count}` : ""}
              {r.watched ? " · saved" : ""}
            </span>
          </div>
          {showWatch && restaurantId && (
            <WatchButton
              watched={watch.watched}
              busy={watch.busy}
              onClick={() => void watch.toggle()}
              size="sm"
            />
          )}
        </div>
      ) : (
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
              {hasRatings && <Badge variant="neutral">★ {r.attribute_rating_count}</Badge>}
              {hasNotes && <Badge variant="neutral">💬 {r.note_count}</Badge>}
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
          {...intentProps}
        >
          {body}
        </button>
      );
    }

    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        to={restaurantDetailPath(r)}
        viewTransition
        className={className}
        {...intentProps}
      >
        {body}
      </Link>
    );
  },
);
