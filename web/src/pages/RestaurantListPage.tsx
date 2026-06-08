import { useMemo, useState } from "react";

import { api } from "../api/client";
import { RestaurantListCard } from "../components/RestaurantListCard";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Page } from "../components/ui/Page";
import { SkeletonList } from "../components/ui/Skeleton";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import type { RestaurantMapEntry } from "../types";

export function RestaurantListPage() {
  const [restaurants, setRestaurants] = useState<RestaurantMapEntry[]>([]);
  const [query, setQuery] = useState("");
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
    if (!q) return restaurants;
    return restaurants.filter((r) => r.name.toLowerCase().includes(q));
  }, [restaurants, query]);

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
    <Page title="Explore" subtitle="Parent-rated restaurants in Dedham">
      <div className="search-input">
        <input
          className="search"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search restaurants"
        />
      </div>

      {!loading && !error && (
        <div className="explore-summary">
          <Badge tone="brand">{filtered.length} places</Badge>
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
          description="Try a different search term."
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
