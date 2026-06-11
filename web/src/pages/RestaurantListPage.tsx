import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import { RestaurantListCard } from "../components/RestaurantListCard";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Page } from "../components/ui/Page";
import { SkeletonList } from "../components/ui/Skeleton";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import type { RestaurantMapEntry } from "../types";

type RestaurantFilter = "all" | "fast-starters" | "parent-data" | "needs-data";

const filterLabels: Record<RestaurantFilter, string> = {
  all: "All",
  "fast-starters": "Quick starters",
  "parent-data": "Parent-rated",
  "needs-data": "Needs scouting",
};

function getFilter(value: string | null): RestaurantFilter {
  if (value === "fast-starters" || value === "parent-data" || value === "needs-data") {
    return value;
  }
  return "all";
}

function hasParentData(restaurant: RestaurantMapEntry) {
  return (
    restaurant.ttf.sample_size > 0 ||
    restaurant.attribute_rating_count > 0 ||
    restaurant.note_count > 0
  );
}

function hasFastStarterData(restaurant: RestaurantMapEntry) {
  return (
    restaurant.ttf.sample_size > 0 &&
    restaurant.ttf.median_minutes !== null &&
    restaurant.ttf.median_minutes <= 10
  );
}

function restaurantFilterUrl(filter: RestaurantFilter, query: string) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (query.trim()) params.set("q", query.trim());
  const qs = params.toString();
  return qs ? `/restaurants?${qs}` : "/restaurants";
}

function formatPlaceCount(count: number) {
  return `${count} ${count === 1 ? "place" : "places"}`;
}

export function RestaurantListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = getFilter(searchParams.get("filter"));
  const query = searchParams.get("q") ?? "";
  const [restaurants, setRestaurants] = useState<RestaurantMapEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useRefreshOnNavigate(() => {
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return restaurants.filter((r) => {
      const matchesQuery = !q || r.name.toLowerCase().includes(q);
      if (!matchesQuery) return false;
      if (activeFilter === "fast-starters") return hasFastStarterData(r);
      if (activeFilter === "parent-data") return hasParentData(r);
      if (activeFilter === "needs-data") return !hasParentData(r);
      return true;
    });
  }, [restaurants, query, activeFilter]);

  const withContributions = useMemo(
    () =>
      restaurants.filter(
        (r) =>
          r.ttf.sample_size > 0 ||
          r.attribute_rating_count > 0 ||
          r.note_count > 0,
      ).length,
    [restaurants],
  );

  return (
    <Page
      title={activeFilter === "all" ? "Explore" : filterLabels[activeFilter]}
      subtitle="Parent-rated restaurants in Dedham"
    >
      <div className="search-input">
        <input
          className="search"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => {
            const nextQuery = e.target.value;
            const params = new URLSearchParams(searchParams);
            if (nextQuery.trim()) {
              params.set("q", nextQuery);
            } else {
              params.delete("q");
            }
            setSearchParams(params, { replace: true });
          }}
          aria-label="Search restaurants"
        />
      </div>

      <nav className="explore-filters" aria-label="Restaurant filters">
        {(Object.keys(filterLabels) as RestaurantFilter[]).map((filter) => (
          <Link
            key={filter}
            className={`explore-filter${filter === activeFilter ? " explore-filter--active" : ""}`}
            to={restaurantFilterUrl(filter, query)}
          >
            {filterLabels[filter]}
          </Link>
        ))}
      </nav>

      {!loading && !error && (
        <div className="explore-summary">
          <Badge tone="brand">{formatPlaceCount(filtered.length)}</Badge>
          {activeFilter !== "all" && (
            <span className="muted small">{filterLabels[activeFilter].toLowerCase()} filter</span>
          )}
          {withContributions > 0 && (
            <span className="muted small">{withContributions} with parent data</span>
          )}
        </div>
      )}

      {loading && <SkeletonList count={6} />}
      {error && <p className="error">{error}</p>}

      {!loading && !error && filtered.length > 0 && (
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
          description="Try a different search term or switch filters."
        />
      )}

      {!loading && !error && restaurants.length === 0 && (
        <EmptyState
          emoji="🔎"
          title="No restaurants"
          description="Check back after the next seed run."
        />
      )}
    </Page>
  );
}
