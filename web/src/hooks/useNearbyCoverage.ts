import { useCallback, useState } from "react";

import { ApiError, api } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export type CoverageState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "requesting" }
  | { status: "queued"; message: string }
  | { status: "covered"; message: string }
  | { status: "out_of_area"; message: string }
  | { status: "error"; message: string };

const PILOT_LABEL = "Dedham, MA";

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

/**
 * Requests the user's location (only on explicit call) and asks the API to
 * ensure that area is seeded. Fire-and-forget: seeding runs in the background.
 */
export function useNearbyCoverage(onQueued?: () => void) {
  const { idToken } = useAuth();
  const [state, setState] = useState<CoverageState>({ status: "idle" });

  const requestCoverage = useCallback(async () => {
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
      const denied =
        typeof err === "object" && err !== null && "code" in err;
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

    setState({ status: "requesting" });
    try {
      const res = await api.ensureCoverage(
        {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        idToken,
      );
      if (res.status === "queued") {
        setState({
          status: "queued",
          message: "Finding restaurants near you… this can take a moment.",
        });
        onQueued?.();
      } else if (res.status === "covered") {
        setState({
          status: "covered",
          message: `You're covered — ${res.restaurant_count} restaurants nearby.`,
        });
      } else {
        setState({
          status: "out_of_area",
          message: `We're not in your area yet — currently piloting in ${PILOT_LABEL}.`,
        });
      }
    } catch (err) {
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
  }, [idToken, onQueued]);

  return { state, requestCoverage, signedIn: Boolean(idToken) };
}
