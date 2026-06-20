import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { userStorage } from "../lib/userStorage";

export function useWatch(restaurantId: string | null | undefined, initialWatched = false) {
  const { idToken } = useAuth();
  const navigate = useNavigate();
  const watchKey = `${restaurantId ?? ""}:${initialWatched}`;
  const [state, setState] = useState({ key: watchKey, watched: initialWatched });
  if (state.key !== watchKey) {
    setState({ key: watchKey, watched: initialWatched });
  }
  const watched = state.watched;
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (!restaurantId) return;
    if (!idToken) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setBusy(true);
    const next = !watched;
    setState((prev) => ({ ...prev, watched: next }));
    const optimistic = { ...userStorage.getWatchOptimistic(), [restaurantId]: next };
    userStorage.setWatchOptimistic(optimistic);
    try {
      if (next) {
        await api.watchRestaurant(restaurantId, idToken);
      } else {
        await api.unwatchRestaurant(restaurantId, idToken);
      }
      delete optimistic[restaurantId];
      userStorage.setWatchOptimistic(optimistic);
    } catch {
      setState((prev) => ({ ...prev, watched: !next }));
    } finally {
      setBusy(false);
    }
  }, [idToken, navigate, restaurantId, watched]);

  return { watched, busy, toggle };
}
