import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export type CoverageState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "requesting" }
  | { status: "seeding"; message: string }
  | { status: "covered"; message: string }
  | { status: "error"; message: string };

const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 90_000;

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location isn't available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 60_000,
    });
  });
}

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
  // Guards against setState / further polling after the component unmounts.
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
          continue; // transient error — keep polling until the deadline
        }
        if (!activeRef.current) return;
        if (job.status === "succeeded") {
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
        // pending / running / skipped → keep waiting
      }
      // Timed out while still running; refresh anyway in case it just landed.
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
          message: "Sign in to improve restaurant coverage in this area.",
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
            message: "Finding restaurants here… this can take a moment.",
          });
          await pollJob(res.job_id, idToken);
        } else {
          setState({
            status: "covered",
            message: `You're covered — ${res.restaurant_count} restaurants nearby.`,
          });
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
    [idToken, pollJob],
  );

  const requestNearMe = useCallback(async () => {
    if (!idToken) {
      setState({
        status: "error",
        message: "Sign in to improve restaurant coverage near you.",
      });
      return;
    }

    setState({ status: "locating" });
    let position: GeolocationPosition;
    try {
      position = await getCurrentPosition();
    } catch (err) {
      const denied = typeof err === "object" && err !== null && "code" in err;
      setState({
        status: "error",
        message: denied
          ? "Location permission denied or unavailable."
          : err instanceof Error
            ? err.message
            : "Could not get your location.",
      });
      return;
    }
    if (!activeRef.current) return;
    await ensureAt(position.coords.latitude, position.coords.longitude);
  }, [idToken, ensureAt]);

  return {
    state,
    requestNearMe,
    ensureAt,
    signedIn: Boolean(idToken),
  };
}
