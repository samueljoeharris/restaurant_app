import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const HOVER_INTENT_MS = 100;

/**
 * Intent-to-navigate handlers (#80): mouse hover held ≥100ms, or touchstart.
 * Spread the returned props onto the link/card element. Callers are expected
 * to make `prefetch` idempotent (cache-level dedupe), so repeat intent is fine.
 */
export function useIntentPrefetch(prefetch: () => void) {
  const prefetchRef = useRef(prefetch);
  useEffect(() => {
    prefetchRef.current = prefetch;
  });
  const timerRef = useRef<number | null>(null);

  const cancelHoverTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cancelHoverTimer, [cancelHoverTimer]);

  const onPointerEnter = useCallback(
    (event: ReactPointerEvent) => {
      if (event.pointerType !== "mouse") return;
      cancelHoverTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        prefetchRef.current();
      }, HOVER_INTENT_MS);
    },
    [cancelHoverTimer],
  );

  const onTouchStart = useCallback(() => {
    prefetchRef.current();
  }, []);

  return { onPointerEnter, onPointerLeave: cancelHoverTimer, onTouchStart };
}
