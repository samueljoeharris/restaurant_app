import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { runBackgroundCoverage } from "../lib/backgroundCoverage";
import {
  buildPendingPlaceParams,
  RESTAURANT_SEED_RADIUS_M,
  type PlaceSearchPending,
  type RestaurantSearchSelection,
} from "../lib/searchNavigation";

/** Navigate to explore or restaurant detail; seed coverage in the background when we have coords. */
export function usePlaceSearchHandlers() {
  const navigate = useNavigate();
  const { idToken } = useAuth();

  const handleSelectPlace = useCallback(
    (pending: PlaceSearchPending) => {
      const params = buildPendingPlaceParams(pending);
      navigate(`/restaurants?${params.toString()}`, {
        state: { placeSessionToken: pending.session_token },
      });
    },
    [navigate],
  );

  const handleSelectRestaurant = useCallback(
    (selection: RestaurantSearchSelection) => {
      if (idToken && selection.lat != null && selection.lng != null) {
        runBackgroundCoverage(selection.lat, selection.lng, RESTAURANT_SEED_RADIUS_M, idToken);
      }
      navigate(`/restaurants/${selection.restaurant_id}`);
    },
    [navigate, idToken],
  );

  return { handleSelectPlace, handleSelectRestaurant };
}
