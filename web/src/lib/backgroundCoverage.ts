import { api } from "../api/client";

const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 90_000;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Poll a coverage seed job until it finishes or times out. */
export async function pollCoverageJob(
  jobId: string,
  token: string,
): Promise<"succeeded" | "failed" | "timeout"> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await delay(POLL_INTERVAL_MS);
    try {
      const job = await api.getCoverageJob(jobId, token);
      if (job.status === "succeeded") return "succeeded";
      if (job.status === "failed") return "failed";
    } catch {
      continue;
    }
  }
  return "timeout";
}

/** Fire-and-forget area seed; optional callback when the job finishes or area is already covered. */
export function runBackgroundCoverage(
  lat: number,
  lng: number,
  radius_m: number,
  idToken: string,
  onComplete?: () => void,
): void {
  void (async () => {
    try {
      const res = await api.ensureCoverage({ lat, lng, radius_m }, idToken);
      if (res.status === "covered") {
        onComplete?.();
        return;
      }
      if (res.status === "queued" && res.job_id) {
        await pollCoverageJob(res.job_id, idToken);
        onComplete?.();
      }
    } catch {
      // Background work — failures are non-blocking for the user.
    }
  })();
}
