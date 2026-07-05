import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { useToast } from "../components/ui/useToast";
import { invalidateWatchData } from "../lib/pageDataCache";
import { setRestaurantWatched } from "../lib/restaurantMapCache";
import { userStorage } from "../lib/userStorage";
import { notifyWatchlistChanged, resolveWatchedState } from "../lib/watchlist";

export function useWatch(restaurantId: string | null | undefined, initialWatched = false) {
  const { idToken } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  // Bumps after optimistic map edits so we re-read localStorage in render.
  const [revision, setRevision] = useState(0);
  void revision;
  const watched = resolveWatchedState(
    restaurantId,
    initialWatched,
    userStorage.getWatchOptimistic(),
  );
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (!restaurantId) return;
    if (!idToken) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setBusy(true);
    const next = !watched;
    const optimistic = { ...userStorage.getWatchOptimistic(), [restaurantId]: next };
    userStorage.setWatchOptimistic(optimistic);
    setRevision((n) => n + 1);
    try {
      if (next) {
        await api.watchRestaurant(restaurantId, idToken);
      } else {
        await api.unwatchRestaurant(restaurantId, idToken);
      }
      const cleared = { ...optimistic };
      delete cleared[restaurantId];
      userStorage.setWatchOptimistic(cleared);
      setRestaurantWatched(restaurantId, next);
      invalidateWatchData(restaurantId);
      notifyWatchlistChanged(restaurantId, next);
      setRevision((n) => n + 1);
    } catch (err) {
      const reverted = { ...optimistic };
      delete reverted[restaurantId];
      userStorage.setWatchOptimistic(reverted);
      setRevision((n) => n + 1);
      const message = err instanceof Error ? err.message : "Could not update saved spot";
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }, [idToken, navigate, restaurantId, toast, watched]);

  return { watched, busy, toggle };
}
