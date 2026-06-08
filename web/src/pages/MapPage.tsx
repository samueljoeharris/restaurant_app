import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import { RestaurantMap } from "../components/RestaurantMap";
import type { RestaurantMapEntry } from "../types";

export function MapPage() {
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [restaurants, setRestaurants] = useState<RestaurantMapEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .listRestaurantsForMap()
      .then(setRestaurants)
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="map-page">
      <RestaurantMap
        restaurants={restaurants}
        focusId={focusId}
        loading={loading}
        error={error}
      />
    </div>
  );
}
