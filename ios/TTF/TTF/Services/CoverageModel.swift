import Foundation
import MapKit
import Observation

// MARK: - Wire models (mirror api/ttf_api/schemas.py)

/// Body for `POST /v1/coverage/ensure`. Mirrors `CoverageEnsureRequest`.
struct CoverageEnsureRequest: Encodable {
    let lat: Double
    let lng: Double
    let radiusM: Int

    enum CodingKeys: String, CodingKey {
        case lat, lng
        case radiusM = "radius_m"
    }
}

/// Response from `POST /v1/coverage/ensure`. Mirrors `CoverageEnsureResponse`.
struct CoverageEnsureResponse: Decodable {
    /// `"queued"` (a background seed started) or `"covered"` (already dense enough).
    let status: String
    let restaurantCount: Int
    let radiusM: Int
    let jobID: UUID?
    let reused: Bool

    enum CodingKeys: String, CodingKey {
        case status, reused
        case restaurantCount = "restaurant_count"
        case radiusM = "radius_m"
        case jobID = "job_id"
    }
}

/// Response from `GET /v1/coverage/jobs/{id}`. Mirrors `CoverageJobStatus`.
struct CoverageJobStatus: Decodable {
    let jobID: UUID
    /// `pending | running | succeeded | failed | skipped`.
    let status: String
    let insertedCount: Int
    let updatedCount: Int

    enum CodingKeys: String, CodingKey {
        case status
        case jobID = "job_id"
        case insertedCount = "inserted_count"
        case updatedCount = "updated_count"
    }
}

// MARK: - Viewport geometry

/// Pure helpers shared by the map view and coverage model. Constants mirror the
/// web client (`web/src/components/RestaurantMap.tsx`) so iOS and web seed the
/// same areas: server clamps `radius_m` to 1_000…25_000 either way.
enum CoverageGeo {
    static let minRadiusM = 1_000
    static let maxRadiusM = 25_000
    /// Viewport is "sparse" (worth offering a seed) at or below this many pins.
    static let sparseViewportMax = 3

    /// Meters per degree of latitude — same constant the web client uses.
    private static let metersPerDegree = 111_320.0

    /// Radius (meters) of the largest circle that fits inside `region`, clamped to
    /// the server's accepted range. Takes the smaller of the lat/lng half-spans so
    /// the seeded circle never spills past the visible viewport.
    static func radiusMeters(for region: MKCoordinateRegion) -> Int {
        let halfLatM = (region.span.latitudeDelta * metersPerDegree) / 2
        let halfLngM = (region.span.longitudeDelta * metersPerDegree
            * cos(region.center.latitude * .pi / 180)) / 2
        let radius = min(halfLatM, halfLngM)
        let clamped = max(Double(minRadiusM), min(Double(maxRadiusM), radius))
        return Int(clamped.rounded())
    }
}

extension MKCoordinateRegion {
    /// Whether `coordinate` falls within this region's lat/lng bounds. Adequate for
    /// the pilot footprint (no antimeridian/pole wrapping to worry about).
    func contains(_ coordinate: CLLocationCoordinate2D) -> Bool {
        let minLat = center.latitude - span.latitudeDelta / 2
        let maxLat = center.latitude + span.latitudeDelta / 2
        let minLng = center.longitude - span.longitudeDelta / 2
        let maxLng = center.longitude + span.longitudeDelta / 2
        return (minLat...maxLat).contains(coordinate.latitude)
            && (minLng...maxLng).contains(coordinate.longitude)
    }
}

// MARK: - Coverage model

/// Drives the "Search this area" flow: ask the backend to seed the viewport, then
/// poll the background job to completion. Mirrors web's `useNearbyCoverage`, with
/// latest-wins cancellation so a newer search supersedes an in-flight one.
@Observable
@MainActor
final class CoverageModel {
    enum Phase: Equatable {
        case idle
        case seeding
        case covered(String)
        case error(String)

        var message: String? {
            switch self {
            case .idle: nil
            case .seeding: "Finding restaurants here… this can take a moment."
            case .covered(let text), .error(let text): text
            }
        }

        var isBusy: Bool {
            if case .seeding = self { true } else { false }
        }
    }

    private(set) var phase: Phase = .idle
    private var task: Task<Void, Never>?

    /// Poll cadence and cap — match web (`POLL_INTERVAL_MS` / `POLL_TIMEOUT_MS`).
    static let pollInterval: Duration = .seconds(4)
    static let pollTimeout: Duration = .seconds(90)

    /// Seed the visible viewport. Cancels any in-flight search first (latest-wins),
    /// then refreshes `store` once the backend reports the area is seeded.
    func searchThisArea(region: MKCoordinateRegion, api: APIClient, store: RestaurantStore) {
        task?.cancel()
        let radius = CoverageGeo.radiusMeters(for: region)
        let lat = region.center.latitude
        let lng = region.center.longitude
        phase = .seeding
        task = Task {
            do {
                let response = try await api.ensureCoverage(lat: lat, lng: lng, radiusM: radius)
                try Task.checkCancellation()
                if response.status == "queued", let jobID = response.jobID {
                    try await pollJob(jobID, api: api, store: store)
                } else {
                    phase = .covered("You're covered — \(response.restaurantCount) restaurants nearby.")
                }
            } catch is CancellationError {
                // Superseded by a newer search — leave the newer task's state alone.
            } catch APIError.httpStatus(429, _) {
                phase = .error("Daily coverage request limit reached. Try again tomorrow.")
            } catch APIError.unauthorized {
                phase = .error("Sign in to improve restaurant coverage in this area.")
            } catch {
                phase = .error(error.localizedDescription)
            }
        }
    }

    /// Show the sign-in prompt without spending a network round-trip (the seed
    /// endpoint is auth-gated; web gates the same way before calling it).
    func signInRequired() {
        task?.cancel()
        phase = .error("Sign in to improve restaurant coverage in this area.")
    }

    /// Clear any banner and stop polling.
    func dismiss() {
        task?.cancel()
        phase = .idle
    }

    private func pollJob(_ jobID: UUID, api: APIClient, store: RestaurantStore) async throws {
        let deadline = ContinuousClock.now + Self.pollTimeout
        while ContinuousClock.now < deadline {
            try await Task.sleep(for: Self.pollInterval)
            try Task.checkCancellation()

            let job: CoverageJobStatus
            do {
                job = try await api.getCoverageJob(id: jobID)
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                continue // Transient poll failure — keep trying until the deadline.
            }

            switch job.status {
            case "succeeded", "skipped":
                // `skipped` means the area was already covered by the time the worker
                // ran; treat it as success (web keeps polling, but terminating here is
                // both correct and a nicer UX).
                await store.refresh(api: api)
                phase = .covered(Self.seededMessage(job.insertedCount))
                return
            case "failed":
                phase = .error("Coverage update failed. Please try again.")
                return
            default:
                continue // pending | running — keep waiting.
            }
        }
        // Timed out while still running: refresh so any rows seeded so far appear.
        await store.refresh(api: api)
        phase = .covered("Still working — results will appear shortly.")
    }

    private static func seededMessage(_ insertedCount: Int) -> String {
        insertedCount <= 0
            ? "Coverage is up to date near you."
            : "Added \(insertedCount) restaurant\(insertedCount == 1 ? "" : "s") near you."
    }
}
