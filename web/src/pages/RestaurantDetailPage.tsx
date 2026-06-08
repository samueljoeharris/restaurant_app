import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api/client";
import type { RestaurantDetailResponse } from "../types";

export function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<RestaurantDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getRestaurant(id)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
  }, [id]);

  if (error) {
    return (
      <main className="page narrow">
        <p className="error">{error}</p>
        <Link to="/restaurants">← Back</Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page narrow">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  const { restaurant: r, ttf } = data;

  return (
    <main className="page narrow">
      <Link to="/restaurants" className="back">
        ← Restaurants
      </Link>
      <h1>{r.name}</h1>
      <p>{r.address}</p>
      {r.cuisine_tags.length > 0 && (
        <p className="tags">{r.cuisine_tags.join(" · ")}</p>
      )}
      <section className="card">
        <h2>Time to Fries</h2>
        {ttf.sample_size === 0 ? (
          <p className="muted">No observations yet — be the first.</p>
        ) : (
          <ul className="stats">
            <li>
              <span>Median wait</span>
              <strong>{ttf.median_minutes ?? "—"} min</strong>
            </li>
            <li>
              <span>Avg quality</span>
              <strong>{ttf.avg_quality?.toFixed(1) ?? "—"}</strong>
            </li>
            <li>
              <span>Observations</span>
              <strong>{ttf.sample_size}</strong>
            </li>
          </ul>
        )}
        <Link to={`/restaurants/${r.id}/submit`} className="button">
          Submit observation
        </Link>
      </section>
      {r.google_maps_url && (
        <a href={r.google_maps_url} target="_blank" rel="noreferrer" className="button secondary">
          Open in Google Maps
        </a>
      )}
    </main>
  );
}
