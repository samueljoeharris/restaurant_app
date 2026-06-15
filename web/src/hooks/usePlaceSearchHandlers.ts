import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { runBackgroundCoverage } from "../lib/backgroundCoverage";
import {
  buildMapFocusPath,
  buildMapPendingPlacePath,
  RESTAURANT_SEED_RADIUS_M,
  type MapFocusState,
  type PlaceSearchPending,
  type RestaurantSearchSelection,
} from "../lib/searchNavigation";

/** Navigate to the map; seed coverage in the background when we have coords. */
export function usePlaceSearchHandlers() {
  const navigate = useNavigate();
  const { idToken } = useAuth();

  const handleSelectPlace = useCallback(
    (pending: PlaceSearchPending) => {
      navigate(buildMapPendingPlacePath(pending), {
        state: { placeSessionToken: pending.session_token } satisfies MapFocusState,
      });
    },
    [navigate],
  );

  const handleSelectRestaurant = useCallback(
    (selection: RestaurantSearchSelection) => {
      if (idToken && selection.lat != null && selection.lng != null) {
        runBackgroundCoverage(selection.lat, selection.lng, RESTAURANT_SEED_RADIUS_M, idToken);
      }
      const state: MapFocusState | undefined =
        selection.lat != null && selection.lng != null
          ? { focusLocation: { lat: selection.lat, lng: selection.lng } }
          : undefined;
      navigate(buildMapFocusPath(selection), { state });
    },
    [navigate, idToken],
  );

  return { handleSelectPlace, handleSelectRestaurant };
}
