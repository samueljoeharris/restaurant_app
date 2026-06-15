import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import type { PlaceSuggestion } from "../types";

const DEBOUNCE_MS = 250;

export function usePlacesAutocomplete(opts?: { lat?: number; lng?: number }) {
  const { idToken } = useAuth();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One UUID per typing session; regenerated after each resolve.
  const sessionTokenRef = useRef<string>(crypto.randomUUID());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cancellation token: incremented on each new fetch to discard stale results.
  const cancelRef = useRef<number>(0);

  const search = useCallback(
    (q: string) => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
      }

      if (!q.trim()) {
        setSuggestions([]);
        setLoading(false);
        setError(null);
        return;
      }

      if (!idToken) {
        setSuggestions([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      const ticket = ++cancelRef.current;
      const lat = opts?.lat;
      const lng = opts?.lng;

      debounceRef.current = setTimeout(async () => {
        try {
          const result = await api.placesAutocomplete(
            q,
            {
              sessionToken: sessionTokenRef.current,
              lat,
              lng,
            },
            idToken,
          );
          if (ticket !== cancelRef.current) return;
          setSuggestions(result.suggestions);
          setError(null);
        } catch (err) {
          if (ticket !== cancelRef.current) return;
          setError(err instanceof Error ? err.message : "Autocomplete failed");
          setSuggestions([]);
        } finally {
          if (ticket === cancelRef.current) setLoading(false);
        }
      }, DEBOUNCE_MS);
    },
    [idToken, opts],
  );

  /** Call after a successful resolvePlace to start a new billing session. */
  const resetSessionToken = useCallback(() => {
    sessionTokenRef.current = crypto.randomUUID();
  }, []);

  /** Cancel any in-flight debounce on unmount. */
  useEffect(() => {
    const debounce = debounceRef;
    const cancel = cancelRef;
    return () => {
      if (debounce.current != null) clearTimeout(debounce.current);
      cancel.current++;
    };
  }, []);

  return {
    suggestions,
    loading,
    error,
    requiresSignIn: !idToken,
    search,
    resetSessionToken,
    sessionToken: sessionTokenRef,
  };
}
