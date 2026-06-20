import { useEffect, useState } from "react";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { getCachedPlacePractical, setCachedPlacePractical } from "../lib/placePracticalCache";
import type { PlacePracticalResponse } from "../types";

type UsePlacePracticalResult = {
  data: PlacePracticalResponse | null;
  loading: boolean;
  error: string | null;
};

type FetchState = {
  placeId: string;
  data: PlacePracticalResponse | null;
  error: string | null;
};

export function usePlacePractical(placeId: string | null | undefined): UsePlacePracticalResult {
  const { idToken } = useAuth();
  const enabled = Boolean(placeId && idToken);
  const cached = enabled && placeId ? getCachedPlacePractical(placeId) : null;
  const [fetchState, setFetchState] = useState<FetchState | null>(null);

  useEffect(() => {
    if (!enabled || !placeId || !idToken || cached) {
      return;
    }
    if (fetchState?.placeId === placeId && (fetchState.data || fetchState.error)) {
      return;
    }

    let cancelled = false;

    void api
      .getPlacePractical(placeId, idToken)
      .then((result) => {
        if (cancelled) return;
        setCachedPlacePractical(placeId, result);
        setFetchState({ placeId, data: result, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchState({
          placeId,
          data: null,
          error: err instanceof Error ? err.message : "Could not load place info",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, placeId, idToken, cached, fetchState?.placeId, fetchState?.data, fetchState?.error]);

  if (!enabled) {
    return { data: null, loading: false, error: null };
  }

  const activeFetch = fetchState?.placeId === placeId ? fetchState : null;

  return {
    data: cached ?? activeFetch?.data ?? null,
    loading: !cached && !activeFetch,
    error: activeFetch?.error ?? null,
  };
}
