import Foundation

/// Fire-and-forget coverage seeding — mirrors web `backgroundCoverage.ts`.
enum BackgroundCoverage {
    static let defaultSearchRadiusM = 8_000
    static let restaurantSeedRadiusM = 1_000

    private static let pollInterval: Duration = .seconds(4)
    private static let pollTimeout: Duration = .seconds(90)

    /// Queue a background seed and optionally refresh UI when the job finishes.
    static func run(
        api: APIClient,
        lat: Double,
        lng: Double,
        radiusM: Int,
        onComplete: (@MainActor () async -> Void)? = nil
    ) {
        Task { @MainActor in
            do {
                let response = try await api.ensureCoverage(lat: lat, lng: lng, radiusM: radiusM)
                if response.status == "queued", let jobID = response.jobID {
                    try await pollJob(jobID: jobID, api: api)
                }
                if let onComplete {
                    await onComplete()
                }
            } catch {
                // Background work — failures are non-blocking for the user.
            }
        }
    }

    private static func pollJob(jobID: UUID, api: APIClient) async throws {
        let deadline = ContinuousClock.now + pollTimeout
        while ContinuousClock.now < deadline {
            try await Task.sleep(for: pollInterval)
            let job: CoverageJobStatus
            do {
                job = try await api.getCoverageJob(id: jobID)
            } catch {
                continue
            }
            if job.status == "succeeded" || job.status == "failed" || job.status == "skipped" {
                return
            }
        }
    }
}
