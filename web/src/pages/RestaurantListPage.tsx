import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Page } from "../components/ui/Page";
import { SkeletonList } from "../components/ui/Skeleton";
import type { RestaurantSummary } from "../types";

export function RestaurantListPage() {
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listRestaurants(query.trim() || undefined)
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
  }, [query]);

  return (
    <Page
      title="Explore"
      subtitle="Parent-rated restaurants in Dedham"
    >
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
        <Badge tone="brand">{restaurants.length} places</Badge>
      )}

      {loading && <SkeletonList count={6} />}
      {error && <p className="error">{error}</p>}

      {!loading && !error && restaurants.length > 0 && (
        <ul className="list">
          {restaurants.map((r) => (
            <li key={r.id}>
              <Link to={`/restaurants/${r.id}`} className="restaurant-card">
                <span className="restaurant-card__name">{r.name}</span>
                <span className="restaurant-card__meta">{r.address}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && restaurants.length === 0 && (
        <EmptyState
          emoji="🔎"
          title="No matches"
          description="Try a different search or check back after the next seed run."
        />
      )}
    </Page>
  );
}
