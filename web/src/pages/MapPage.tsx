import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { MapLocateFab } from "../components/MapLocateFab";
import { RestaurantMap } from "../components/RestaurantMap";
import { geolocationErrorMessage, getCurrentPosition } from "../lib/geolocation";
import { runBackgroundCoverage } from "../lib/backgroundCoverage";
import { DEFAULT_SEARCH_RADIUS_M } from "../lib/searchNavigation";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import type { RestaurantMapEntry } from "../types";

export function MapPage() {
  const { idToken } = useAuth();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [restaurants, setRestaurants] = useState<RestaurantMapEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const cancelledRef = useRef(false);
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
      const reqId = ++viewportReqRef.current;
      return api
        .listRestaurantsForMap(bbox)
        .then((data) => {
          if (cancelledRef.current) return;
          if (reqId !== viewportReqRef.current) return;
          setRestaurants(data);
        })
        .catch(() => {
          // Keep existing markers on transient errors.
        });
    },
    [],
  );

  const refreshMap = useCallback(() => {
    void loadRestaurants();
  }, [loadRestaurants]);

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

  const seedArea = useCallback(
    (lat: number, lng: number, radiusM: number, message: string) => {
      if (!idToken) {
        setStatusMessage("Sign in to find more restaurants in this area.");
        return;
      }
      setSeeding(true);
      setStatusMessage(message);
      runBackgroundCoverage(lat, lng, radiusM, idToken, () => {
        setSeeding(false);
        setStatusMessage(null);
        refreshMap();
      });
    },
    [idToken, refreshMap],
  );

  const handleLocateMe = useCallback(async () => {
    setLocating(true);
    setStatusMessage(null);
    try {
      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setUserLocation({ lat, lng });
      if (idToken) {
        seedArea(lat, lng, DEFAULT_SEARCH_RADIUS_M, "Finding restaurants near you…");
      }
    } catch (err) {
      setStatusMessage(geolocationErrorMessage(err));
    } finally {
      setLocating(false);
    }
  }, [idToken, seedArea]);

  const handleSearchArea = useCallback(
    (lat: number, lng: number, radiusM: number) => {
      seedArea(lat, lng, radiusM, "Searching this area…");
    },
    [seedArea],
  );

  return (
    <div className="map-page">
      {statusMessage && (
        <p
          className={`map-status-toast${statusMessage.includes("Sign in") || statusMessage.includes("denied") || statusMessage.includes("unavailable") ? " map-status-toast--error" : ""}`}
          role="status"
        >
          {statusMessage}
        </p>
      )}

      <RestaurantMap
        restaurants={restaurants}
        focusId={focusId}
        loading={loading}
        error={error}
        searchBusy={seeding}
        userLocation={userLocation}
        onSearchArea={handleSearchArea}
        onViewportChange={(bbox) => void loadForViewport(bbox)}
      />

      <MapLocateFab busy={locating} active={userLocation !== null} onClick={() => void handleLocateMe()} />
    </div>
  );
}
