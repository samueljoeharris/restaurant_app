/** Browser geolocation with sensible defaults for map centering. */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location isn't available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 30_000,
    });
  });
}

export function geolocationErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as GeolocationPositionError).code;
    if (code === 1) return "Location permission denied. Enable it in browser settings.";
    if (code === 2) return "Location unavailable right now.";
    if (code === 3) return "Location request timed out. Try again.";
  }
  return err instanceof Error ? err.message : "Could not get your location.";
}
