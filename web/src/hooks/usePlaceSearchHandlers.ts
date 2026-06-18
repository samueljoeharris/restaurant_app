import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildMapPendingPlacePath,
  buildMapRestaurantPath,
  type MapFocusState,
  type PlaceSearchPending,
  type RestaurantSearchSelection,
} from "../lib/searchNavigation";

/** Navigate to the map; seed coverage in the background when we have coords. */
export function usePlaceSearchHandlers() {
  const navigate = useNavigate();

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
      const state: MapFocusState | undefined =
        selection.lat != null && selection.lng != null
          ? {
              focusLocation: { lat: selection.lat, lng: selection.lng },
              optimisticRestaurant: selection,
            }
          : undefined;
      navigate(buildMapRestaurantPath(selection), { state });
    },
    [navigate],
  );

  return { handleSelectPlace, handleSelectRestaurant };
}
