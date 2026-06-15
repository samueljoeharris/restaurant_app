import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export type AreaCoverageState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "seeding" }
  | { status: "done" }
  | { status: "error"; message: string };

const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 90_000;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Shared polling helper. Returns a function that polls a job to completion
 * and calls `onComplete` when done. Uses `activeRef` to avoid state updates
 * after unmount.
 */
export function usePollCoverageJob(
  activeRef: React.MutableRefObject<boolean>,
  onComplete?: () => void,
) {
  return useCallback(
    async (
      jobId: string,
      token: string,
      setState: (s: AreaCoverageState) => void,
    ) => {
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await delay(POLL_INTERVAL_MS);
        if (!activeRef.current) return;
        let job;
        try {
          job = await api.getCoverageJob(jobId, token);
        } catch {
          continue; // transient — keep polling until deadline
        }
        if (!activeRef.current) return;
        if (job.status === "succeeded") {
          setState({ status: "done" });
          onComplete?.();
          return;
        }
        if (job.status === "failed") {
          setState({ status: "error", message: "Coverage update failed. Please try again." });
          return;
        }
        // pending / running / skipped → keep waiting
      }
      // Timed out; trigger a refresh anyway in case results just landed.
      if (activeRef.current) {
        setState({ status: "done" });
        onComplete?.();
      }
    },
    [activeRef, onComplete],
  );
}

/**
 * Calls ensureCoverage for an explicit lat/lng/radius_m (no geolocation),
 * polls the job to completion, and invokes `onComplete` so the caller can
 * re-fetch search results.
 */
export function useAreaCoverage(onComplete?: () => void) {
  const { idToken } = useAuth();
  const [state, setState] = useState<AreaCoverageState>({ status: "idle" });
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const pollJob = usePollCoverageJob(activeRef, onComplete);

  const ensureArea = useCallback(
    async (lat: number, lng: number, radius_m?: number) => {
      if (!idToken) return; // signed-out users skip seeding silently
      setState({ status: "requesting" });
      try {
        const res = await api.ensureCoverage(
          radius_m != null ? { lat, lng, radius_m } : { lat, lng },
          idToken,
        );
        if (!activeRef.current) return;
        if (res.status === "queued" && res.job_id) {
          setState({ status: "seeding" });
          await pollJob(res.job_id, idToken, setState);
        } else {
          setState({ status: "done" });
          onComplete?.();
        }
      } catch (err) {
        if (!activeRef.current) return;
        setState({
          status: "error",
          message:
            err instanceof ApiError && err.status === 429
              ? "Daily coverage request limit reached. Try again tomorrow."
              : err instanceof Error
                ? err.message
                : "Coverage request failed.",
        });
      }
    },
    [idToken, pollJob, onComplete],
  );

  return { state, ensureArea };
}
