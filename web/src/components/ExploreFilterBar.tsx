import { Link, useNavigate } from "react-router-dom";

import type { ExploreFacet, ScoutFilter } from "../lib/exploreFacets";
import { SCOUT_FILTER_LABELS } from "../lib/exploreFacets";
import { cn } from "../lib/cn";

interface ExploreFilterBarProps {
  activeFilter: ScoutFilter;
  browseCity: string | null;
  browseZip: string | null;
  browseTag: string | null;
  cities: ExploreFacet[];
  zips: ExploreFacet[];
  tags: ExploreFacet[];
  exploreUrl: (params: {
    filter: ScoutFilter;
    q: string;
    city: string | null;
    zip: string | null;
    tag: string | null;
  }) => string;
  query: string;
  filtersOpen: boolean;
  onToggleFilters: () => void;
}

export function ExploreFilterBar({
  activeFilter,
  browseCity,
  browseZip,
  browseTag,
  cities,
  zips,
  tags,
  exploreUrl,
  query,
  filtersOpen,
  onToggleFilters,
}: ExploreFilterBarProps) {
  const navigate = useNavigate();
  const activeExtraCount = [browseZip, browseTag].filter(Boolean).length;

  return (
    <div className="mb-3 space-y-3 border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex overflow-hidden rounded-md border border-border"
          role="group"
          aria-label="Scout quality filters"
        >
          {(Object.keys(SCOUT_FILTER_LABELS) as ScoutFilter[]).map((filter) => (
            <Link
              key={filter}
              to={exploreUrl({
                filter,
                q: query,
                city: browseCity,
                zip: browseZip,
                tag: browseTag,
              })}
              className={cn(
                "px-3 py-2 text-xs font-bold text-text-muted transition-colors",
                activeFilter === filter && "bg-brand-soft text-brand",
              )}
            >
              {SCOUT_FILTER_LABELS[filter]}
            </Link>
          ))}
        </div>
        <label className="sr-only" htmlFor="explore-town-select">
          Town
        </label>
        <select
          id="explore-town-select"
          className="w-auto max-w-[14rem] min-w-[8rem] rounded-md border border-border bg-surface px-2 py-2 text-xs font-semibold"
          value={browseCity ?? ""}
          onChange={(e) => {
            const city = e.target.value || null;
            navigate(
              exploreUrl({
                filter: activeFilter,
                q: query,
                city,
                zip: city ? null : browseZip,
                tag: browseTag,
              }),
            );
          }}
        >
          <option value="">All towns</option>
          {cities.map((facet) => (
            <option key={facet.key} value={facet.key}>
              {facet.label} ({facet.count})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-md border border-border bg-surface px-3 py-2 text-xs font-bold text-text-muted"
          aria-expanded={filtersOpen}
          onClick={onToggleFilters}
        >
          Filters{activeExtraCount > 0 ? ` (${activeExtraCount})` : ""}
        </button>
      </div>
      {filtersOpen && (
        <div className="space-y-2 rounded-md border border-border/70 bg-bg/50 p-3">
          {zips.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {zips.slice(0, 10).map((facet) => (
                <Link
                  key={facet.key}
                  to={exploreUrl({
                    filter: activeFilter,
                    q: query,
                    city: null,
                    zip: browseZip === facet.key ? null : facet.key,
                    tag: browseTag,
                  })}
                  className={cn(
                    "rounded-full border px-2 py-1 text-xs font-semibold",
                    browseZip === facet.key
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border text-text-muted",
                  )}
                >
                  {facet.label} ({facet.count})
                </Link>
              ))}
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 12).map((facet) => (
                <Link
                  key={facet.key}
                  to={exploreUrl({
                    filter: activeFilter,
                    q: query,
                    city: browseCity,
                    zip: browseZip,
                    tag: browseTag === facet.key ? null : facet.key,
                  })}
                  className={cn(
                    "rounded-full border px-2 py-1 text-xs font-semibold",
                    browseTag === facet.key
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border text-text-muted",
                  )}
                >
                  {facet.label} ({facet.count})
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
