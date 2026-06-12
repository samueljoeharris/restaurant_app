import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import { RestaurantListCard } from "../components/RestaurantListCard";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Page } from "../components/ui/Page";
import { SkeletonList } from "../components/ui/Skeleton";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import {
  buildExploreFacets,
  groupRestaurantsByCity,
  matchesBrowseFilters,
  matchesExploreSearch,
  matchesScoutFilter,
  type ScoutFilter,
} from "../lib/exploreFacets";
import type { RestaurantMapEntry } from "../types";

const scoutFilterLabels: Record<ScoutFilter, string> = {
  all: "All",
  "fast-starters": "Quick starters",
  "parent-data": "Parent-rated",
  "needs-data": "Needs scouting",
};

const scoutFilterSummaries: Record<Exclude<ScoutFilter, "all">, string> = {
  "fast-starters": "Places with starter-speed observations of 10 minutes or less.",
  "parent-data": "Restaurants with at least one parent observation, rating, or note.",
  "needs-data": "Restaurants still waiting for a first parent contribution.",
};

function getScoutFilter(value: string | null): ScoutFilter {
  if (value === "fast-starters" || value === "parent-data" || value === "needs-data") {
    return value;
  }
  return "all";
}

function formatPlaceCount(count: number) {
  return `${count} ${count === 1 ? "place" : "places"}`;
}

function exploreUrl(params: {
  filter: ScoutFilter;
  q: string;
  city: string | null;
  zip: string | null;
  tag: string | null;
}) {
  const search = new URLSearchParams();
  if (params.filter !== "all") search.set("filter", params.filter);
  if (params.q.trim()) search.set("q", params.q.trim());
  if (params.city) search.set("city", params.city);
  if (params.zip) search.set("zip", params.zip);
  if (params.tag) search.set("tag", params.tag);
  const qs = search.toString();
  return qs ? `/restaurants?${qs}` : "/restaurants";
}

function BrowseChip({
  label,
  count,
  active,
  to,
}: {
  label: string;
  count: number;
  active: boolean;
  to: string;
}) {
  return (
    <Link
      className={`explore-filter${active ? " explore-filter--active" : ""}`}
      to={to}
    >
      {label} ({count})
    </Link>
  );
}

export function RestaurantListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = getScoutFilter(searchParams.get("filter"));
  const query = searchParams.get("q") ?? "";
  const browseCity = searchParams.get("city");
  const browseZip = searchParams.get("zip");
  const browseTag = searchParams.get("tag");
  const [restaurants, setRestaurants] = useState<RestaurantMapEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRestaurants = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listRestaurantsForMap()
      .then((data) => {
        if (!cancelled) setRestaurants(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useRefreshOnNavigate(loadRestaurants, [loadRestaurants]);

  const urlState = useMemo(
    () => ({ filter: activeFilter, q: query, city: browseCity, zip: browseZip, tag: browseTag }),
    [activeFilter, query, browseCity, browseZip, browseTag],
  );

  const facets = useMemo(() => buildExploreFacets(restaurants), [restaurants]);

  const filtered = useMemo(
    () =>
      restaurants.filter(
        (r) =>
          matchesExploreSearch(r, query) &&
          matchesBrowseFilters(r, browseCity, browseZip, browseTag) &&
          matchesScoutFilter(r, activeFilter),
      ),
    [restaurants, query, browseCity, browseZip, browseTag, activeFilter],
  );

  const grouped = useMemo(() => {
    const browsing = browseCity || browseZip || browseTag || query.trim();
    if (browsing) return null;
    return groupRestaurantsByCity(filtered);
  }, [filtered, browseCity, browseZip, browseTag, query]);

  const withContributions = useMemo(
    () => restaurants.filter((r) => matchesScoutFilter(r, "parent-data")).length,
    [restaurants],
  );

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (browseCity) parts.push(browseCity);
    else if (browseZip) parts.push(`ZIP ${browseZip}`);
    else if (facets.cities.length > 0) {
      parts.push(`${facets.cities.length} towns`);
    }
    parts.push(`${restaurants.length} places`);
    return parts.join(" · ");
  }, [browseCity, browseZip, facets.cities.length, restaurants.length]);

  const summaryText = useMemo(() => {
    if (activeFilter !== "all") return scoutFilterSummaries[activeFilter];
    const bits: string[] = [];
    if (browseTag) bits.push(browseTag);
    if (browseCity) bits.push(browseCity);
    if (browseZip) bits.push(`ZIP ${browseZip}`);
    if (query.trim()) bits.push(`"${query.trim()}"`);
    if (bits.length > 0) return `Matching ${bits.join(" · ")}`;
    return `${formatPlaceCount(withContributions)} with parent data`;
  }, [activeFilter, browseTag, browseCity, browseZip, query, withContributions]);

  function clearBrowseParam(key: "city" | "zip" | "tag") {
    const params = new URLSearchParams(searchParams);
    params.delete(key);
    setSearchParams(params, { replace: true });
  }

  return (
    <Page
      title={activeFilter === "all" ? "Explore" : scoutFilterLabels[activeFilter]}
      subtitle={subtitle}
    >
      <div className="search-input">
        <input
          className="search"
          placeholder="Search name, town, ZIP, or cuisine…"
          value={query}
          onChange={(e) => {
            const nextQuery = e.target.value;
            const params = new URLSearchParams(searchParams);
            if (nextQuery.trim()) params.set("q", nextQuery);
            else params.delete("q");
            setSearchParams(params, { replace: true });
          }}
          aria-label="Search restaurants"
        />
      </div>

      {!loading && restaurants.length > 0 && (
        <>
          {facets.cities.length > 0 && (
            <nav className="explore-filters" aria-label="Browse by town">
              {facets.cities.slice(0, 8).map((facet) => (
                <BrowseChip
                  key={facet.key}
                  label={facet.label}
                  count={facet.count}
                  active={browseCity === facet.key}
                  to={
                    browseCity === facet.key
                      ? exploreUrl({ ...urlState, city: null })
                      : exploreUrl({ ...urlState, city: facet.key, zip: null })
                  }
                />
              ))}
            </nav>
          )}

          {facets.zips.length > 1 && (
            <nav className="explore-filters explore-filters--secondary" aria-label="Browse by ZIP">
              {facets.zips.slice(0, 8).map((facet) => (
                <BrowseChip
                  key={facet.key}
                  label={facet.label}
                  count={facet.count}
                  active={browseZip === facet.key}
                  to={
                    browseZip === facet.key
                      ? exploreUrl({ ...urlState, zip: null })
                      : exploreUrl({ ...urlState, zip: facet.key, city: null })
                  }
                />
              ))}
            </nav>
          )}

          {facets.tags.length > 0 && (
            <nav className="explore-filters explore-filters--secondary" aria-label="Browse by type">
              {facets.tags.slice(0, 10).map((facet) => (
                <BrowseChip
                  key={facet.key}
                  label={facet.label}
                  count={facet.count}
                  active={browseTag === facet.key}
                  to={
                    browseTag === facet.key
                      ? exploreUrl({ ...urlState, tag: null })
                      : exploreUrl({ ...urlState, tag: facet.key })
                  }
                />
              ))}
            </nav>
          )}
        </>
      )}

      <nav className="explore-filters explore-filters--scout" aria-label="Scout quality filters">
        {(Object.keys(scoutFilterLabels) as ScoutFilter[]).map((filter) => (
          <Link
            key={filter}
            className={`explore-filter${filter === activeFilter ? " explore-filter--active" : ""}`}
            to={exploreUrl({ ...urlState, filter })}
          >
            {scoutFilterLabels[filter]}
          </Link>
        ))}
      </nav>

      {(browseCity || browseZip || browseTag) && (
        <div className="explore-active-browse">
          {browseCity && (
            <button type="button" className="explore-active-browse__chip" onClick={() => clearBrowseParam("city")}>
              {browseCity} ×
            </button>
          )}
          {browseZip && (
            <button type="button" className="explore-active-browse__chip" onClick={() => clearBrowseParam("zip")}>
              ZIP {browseZip} ×
            </button>
          )}
          {browseTag && (
            <button type="button" className="explore-active-browse__chip" onClick={() => clearBrowseParam("tag")}>
              {browseTag} ×
            </button>
          )}
        </div>
      )}

      {!loading && !error && (
        <div className="explore-summary">
          <Badge tone="brand">{formatPlaceCount(filtered.length)}</Badge>
          <span className="muted small">{summaryText}</span>
        </div>
      )}

      {loading && <SkeletonList count={6} />}
      {error && <p className="error">{error}</p>}

      {!loading && !error && filtered.length > 0 && grouped && (
        <div className="explore-groups">
          {grouped.map(({ city, items }) => (
            <section key={city} className="explore-group">
              <header className="explore-group__header">
                <h2>{city}</h2>
                <span className="muted small">{formatPlaceCount(items.length)}</span>
              </header>
              <ul className="list">
                {items.map((r) => (
                  <li key={r.id}>
                    <RestaurantListCard restaurant={r} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && !grouped && (
        <ul className="list">
          {filtered.map((r) => (
            <li key={r.id}>
              <RestaurantListCard restaurant={r} />
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && filtered.length === 0 && restaurants.length > 0 && (
        <EmptyState
          emoji="🔎"
          title="No matches"
          description="Try a different search term, town, ZIP, or filter."
        />
      )}

      {!loading && !error && restaurants.length === 0 && (
        <EmptyState
          emoji="🔎"
          title="No restaurants yet"
          description="The catalog is still filling in for this area. Check back soon."
        />
      )}
    </Page>
  );
}
