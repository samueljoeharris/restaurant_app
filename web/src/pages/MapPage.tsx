import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import { RestaurantMap } from "../components/RestaurantMap";
import { Button } from "../components/ui/Button";
import { useNearbyCoverage } from "../hooks/useNearbyCoverage";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import type { RestaurantMapEntry } from "../types";

export function MapPage() {
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [restaurants, setRestaurants] = useState<RestaurantMapEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cancelledRef = useRef(false);
  // Latest-wins guard for viewport refetches: only the most recent request
  // may apply its results, so out-of-order responses can't clobber the map.
  const viewportReqRef = useRef(0);

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

  const loadForViewport = useCallback(
    (bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => {
      // No loading flag here: keep existing markers until fresh data arrives
      // (avoids flicker while panning/zooming).
      const reqId = ++viewportReqRef.current;
      return api
        .listRestaurantsForMap(bbox)
        .then((data) => {
          if (cancelledRef.current) return;
          // Drop stale responses; only the latest request may apply.
          if (reqId !== viewportReqRef.current) return;
          setRestaurants(data);
        })
        .catch(() => {
          // Ignore transient viewport-fetch errors; leave existing markers in
          // place rather than blanking the map.
        });
    },
    [],
  );

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

  const { state, requestNearMe, ensureAt, signedIn } = useNearbyCoverage(
    useCallback(() => {
      // Refresh the map once the background seed reports completion.
      void loadRestaurants();
    }, [loadRestaurants]),
  );

  const busy =
    state.status === "locating" ||
    state.status === "requesting" ||
    state.status === "seeding";

  return (
    <div className="map-page">
      <div className="coverage-control">
        <Button
          size="sm"
          className="coverage-control__button"
          onClick={() => void requestNearMe()}
          disabled={busy}
        >
          {state.status === "locating"
            ? "Locating…"
            : busy
              ? "Searching…"
              : "Show restaurants near me"}
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
        searchBusy={busy}
        onSearchArea={(lat, lng, radiusM) => void ensureAt(lat, lng, radiusM)}
        onViewportChange={(bbox) => void loadForViewport(bbox)}
      />
    </div>
  );
}
