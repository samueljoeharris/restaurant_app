import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import { RestaurantMap } from "../components/RestaurantMap";
import { Button } from "../components/ui/Button";
import { useNearbyCoverage } from "../hooks/useNearbyCoverage";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import type { RestaurantMapEntry } from "../types";

// How long to wait after a seed is queued before pulling fresh map data.
const COVERAGE_REFRESH_DELAY_MS = 25_000;

export function MapPage() {
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [restaurants, setRestaurants] = useState<RestaurantMapEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cancelledRef = useRef(false);

  const loadRestaurants = useCallback(() => {
    setError(null);
    return api
      .listRestaurantsForMap()
      .then((data) => {
        if (!cancelledRef.current) setRestaurants(data);
      })
      .catch((err) => {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : "Load failed");
        }
      });
  }, []);

  useRefreshOnNavigate(() => {
    cancelledRef.current = false;
    setLoading(true);
    loadRestaurants().finally(() => {
      if (!cancelledRef.current) setLoading(false);
    });
    return () => {
      cancelledRef.current = true;
    };
  }, [loadRestaurants]);

  const { state, requestCoverage, signedIn } = useNearbyCoverage(
    useCallback(() => {
      // Soft-refresh once the background seed has had time to land.
      window.setTimeout(() => void loadRestaurants(), COVERAGE_REFRESH_DELAY_MS);
    }, [loadRestaurants]),
  );

  const busy = state.status === "locating" || state.status === "requesting";

  return (
    <div className="map-page">
      <div className="coverage-control">
        <Button
          size="sm"
          className="coverage-control__button"
          onClick={() => void requestCoverage()}
          disabled={busy}
        >
          {busy ? "Locating…" : "Show restaurants near me"}
        </Button>
        {"message" in state && state.message && (
          <p
            className={`coverage-control__status coverage-control__status--${state.status}`}
          >
            {state.message}
          </p>
        )}
        {!signedIn && state.status === "idle" && (
          <p className="coverage-control__status coverage-control__status--hint">
            Sign in to improve coverage in your area.
          </p>
        )}
      </div>
      <RestaurantMap
        restaurants={restaurants}
        focusId={focusId}
        loading={loading}
        error={error}
      />
    </div>
  );
}
