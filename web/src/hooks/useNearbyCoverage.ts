import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { geolocationErrorMessage, getCurrentPosition } from "../lib/geolocation";

export type CoverageState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "requesting" }
  | { status: "seeding"; message: string }
  | { status: "covered"; message: string }
  | { status: "error"; message: string };

const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 90_000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function seededMessage(insertedCount: number): string {
  if (insertedCount <= 0) return "Coverage is up to date near you.";
  return `Added ${insertedCount} restaurant${insertedCount === 1 ? "" : "s"} near you.`;
}

/**
 * Requests the user's location (only on explicit call) and asks the API to
 * ensure that area is seeded. When a background seed is queued, polls the job
 * to completion and calls `onComplete` so the caller can refresh the map.
 */
export function useNearbyCoverage(onComplete?: () => void) {
  const { idToken } = useAuth();
  const [state, setState] = useState<CoverageState>({ status: "idle" });
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const pollJob = useCallback(
    async (jobId: string, token: string) => {
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await delay(POLL_INTERVAL_MS);
        if (!activeRef.current) return;
        let job;
        try {
          job = await api.getCoverageJob(jobId, token);
        } catch {
          continue;
        }
        if (!activeRef.current) return;
        if (job.status === "succeeded" || job.status === "skipped") {
          setState({ status: "covered", message: seededMessage(job.inserted_count) });
          onComplete?.();
          return;
        }
        if (job.status === "failed") {
          setState({
            status: "error",
            message: "Coverage update failed. Please try again.",
          });
          return;
        }
      }
      if (activeRef.current) {
        setState({
          status: "seeding",
          message: "Still working — results will appear shortly.",
        });
        onComplete?.();
      }
    },
    [onComplete],
  );

  const ensureAt = useCallback(
    async (lat: number, lng: number, radiusM?: number) => {
      if (!idToken) {
        setState({
          status: "error",
          message: "Sign in to find more restaurants in this area.",
        });
        return;
      }
      setState({ status: "requesting" });
      try {
        const res = await api.ensureCoverage(
          radiusM ? { lat, lng, radius_m: radiusM } : { lat, lng },
          idToken,
        );
        if (!activeRef.current) return;
        if (res.status === "queued" && res.job_id) {
          setState({
            status: "seeding",
            message: "Finding restaurants here…",
          });
          await pollJob(res.job_id, idToken);
        } else {
          setState({
            status: "covered",
            message: `You're covered — ${res.restaurant_count} restaurants nearby.`,
          });
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

  /** Center the map on the device location; optionally seed when signed in. */
  const locateNearMe = useCallback(
    async (opts?: { seed?: boolean }) => {
      setState({ status: "locating" });
      try {
        const position = await getCurrentPosition();
        if (!activeRef.current) return null;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (opts?.seed !== false && idToken) {
          await ensureAt(lat, lng);
        } else {
          setState({ status: "idle" });
        }
        return { lat, lng };
      } catch (err) {
        if (!activeRef.current) return null;
        setState({
          status: "error",
          message: geolocationErrorMessage(err),
        });
        return null;
      }
    },
    [idToken, ensureAt],
  );

  const requestNearMe = useCallback(async () => {
    if (!idToken) {
      setState({
        status: "error",
        message: "Sign in to find more restaurants near you.",
      });
      return null;
    }
    return locateNearMe({ seed: true });
  }, [idToken, locateNearMe]);

  return {
    state,
    requestNearMe,
    locateNearMe,
    ensureAt,
    signedIn: Boolean(idToken),
  };
}
