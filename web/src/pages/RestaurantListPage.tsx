import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
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
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Restaurants</h1>
          <p className="muted">Dedham, Massachusetts pilot</p>
        </div>
      </header>
      <input
        className="search"
        placeholder="Search by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}
      <ul className="list">
        {restaurants.map((r) => (
          <li key={r.id}>
            <Link to={`/restaurants/${r.id}`} className="list-item">
              <strong>{r.name}</strong>
              <span className="muted">{r.address}</span>
            </Link>
          </li>
        ))}
      </ul>
      {!loading && !error && restaurants.length === 0 && (
        <p className="muted">No restaurants found.</p>
      )}
    </main>
  );
}
