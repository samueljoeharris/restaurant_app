import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { RestaurantListCard } from "../components/RestaurantListCard";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Page } from "../components/ui/Page";
import { SkeletonList } from "../components/ui/Skeleton";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import type { RestaurantMapEntry, RestaurantSeedJob } from "../types";

export function RestaurantListPage() {
  const { idToken } = useAuth();
  const [restaurants, setRestaurants] = useState<RestaurantMapEntry[]>([]);
  const [query, setQuery] = useState("");
  const [seedLocation, setSeedLocation] = useState("");
  const [seedJob, setSeedJob] = useState<RestaurantSeedJob | null>(null);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
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

  async function pollSeedJob(jobId: string, token: string) {
    try {
      const { job } = await api.getRestaurantSeedJob(jobId, token);
      setSeedJob(job);
      if (job.status === "pending" || job.status === "running") {
        window.setTimeout(() => void pollSeedJob(jobId, token), 2000);
        return;
      }

      setSeedLoading(false);
      if (job.status === "succeeded") {
        setSeedStatus(
          `Search complete: ${job.inserted_count} added, ${job.updated_count} refreshed, ${job.closed_count} closed.`,
        );
        loadRestaurants();
      } else {
        setSeedStatus(job.error || "Restaurant search did not complete.");
      }
    } catch (err) {
      setSeedLoading(false);
      setSeedStatus(err instanceof Error ? err.message : "Could not check search status.");
    }
  }

  async function handleSeedSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const location = seedLocation.trim();
    if (!location) return;
    if (!idToken) {
      setSeedStatus("Sign in to search and seed a new area.");
      return;
    }

    setSeedLoading(true);
    setSeedStatus("Starting restaurant search…");
    setSeedJob(null);
    try {
      const { job, reused } = await api.triggerRestaurantSeed(
        { location, radius_m: 8000 },
        idToken,
      );
      setSeedJob(job);
      if (job.status === "succeeded") {
        setSeedLoading(false);
        setSeedStatus(
          reused
            ? `This area was refreshed recently: ${job.unique_places_count} places found.`
            : `Search complete: ${job.inserted_count} added, ${job.updated_count} refreshed.`,
        );
        loadRestaurants();
        return;
      }
      setSeedStatus(
        reused ? "A search is already running for this area…" : "Searching Google Places…",
      );
      void pollSeedJob(job.id, idToken);
    } catch (err) {
      setSeedLoading(false);
      setSeedStatus(err instanceof Error ? err.message : "Could not start restaurant search.");
    }
  }

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

      <form className="area-seed-card" onSubmit={handleSeedSubmit}>
        <div>
          <label htmlFor="seed-location">Search a new area</label>
          <p className="muted small">
            Enter a ZIP or city and Little Scout will seed restaurants in the background.
          </p>
        </div>
        <div className="area-seed-card__controls">
          <input
            id="seed-location"
            value={seedLocation}
            onChange={(e) => setSeedLocation(e.target.value)}
            placeholder="02026 or Dedham, MA"
            disabled={seedLoading}
          />
          <button type="submit" disabled={seedLoading || !seedLocation.trim()}>
            {seedLoading ? "Searching…" : "Seed area"}
          </button>
        </div>
        {seedStatus && (
          <p className={seedJob?.status === "failed" ? "error small" : "muted small"}>
            {seedStatus}
          </p>
        )}
      </form>

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
