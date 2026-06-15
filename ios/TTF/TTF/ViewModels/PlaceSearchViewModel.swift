import Foundation
import Observation

enum SeedState: Equatable {
    case idle
    case seeding
    case done
    case failed(String)
}

@Observable
@MainActor
final class PlaceSearchViewModel {
    // MARK: - Published state

    private(set) var suggestions: [PlaceSuggestion] = []
    private(set) var isSearching = false
    private(set) var radiusResults: [RestaurantMapEntry] = []
    private(set) var areaLabel: String?
    private(set) var seedState: SeedState = .idle
    /// Set when the user picks a restaurant suggestion — drive navigation in the view.
    private(set) var selectedRestaurantID: UUID?

    // MARK: - Internal

    var sessionToken: String = UUID().uuidString

    private var debounceTask: Task<Void, Never>?
    private var seedPollTask: Task<Void, Never>?

    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    // MARK: - Query debouncing

    /// Call this from the view whenever the search field text changes.
    func queryChanged(_ query: String) {
        debounceTask?.cancel()
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            suggestions = []
            isSearching = false
            return
        }
        debounceTask = Task {
            do {
                try await Task.sleep(nanoseconds: 250_000_000) // 250ms
            } catch {
                return // cancelled
            }
            guard !Task.isCancelled else { return }
            await fetchSuggestions(query: trimmed)
        }
    }

    private func fetchSuggestions(query: String) async {
        isSearching = true
        defer { isSearching = false }
        do {
            suggestions = try await api.placesAutocomplete(query: query, sessionToken: sessionToken)
        } catch {
            // Silently clear — the field stays open for the user to keep typing.
            suggestions = []
        }
    }

    // MARK: - Selection

    func select(_ suggestion: PlaceSuggestion) {
        debounceTask?.cancel()
        suggestions = []

        if suggestion.type == "restaurant", let rid = suggestion.restaurantId, let uuid = UUID(uuidString: rid) {
            // Navigate to the restaurant detail screen.
            selectedRestaurantID = uuid
            return
        }

        // Place suggestion — resolve then radius-search + seed.
        guard let placeId = suggestion.placeId else { return }
        let token = sessionToken

        Task {
            await resolveAndSearch(placeId: placeId, sessionToken: token)
        }
    }

    /// Clear a place-based area search and return to the default list.
    func clearAreaSearch() {
        seedPollTask?.cancel()
        radiusResults = []
        areaLabel = nil
        seedState = .idle
        selectedRestaurantID = nil
        // Generate a new session token for the next typing session.
        sessionToken = UUID().uuidString
    }

    func clearSelectedRestaurant() {
        selectedRestaurantID = nil
    }

    // MARK: - Private

    private func resolveAndSearch(placeId: String, sessionToken: String) async {
        isSearching = true
        defer { isSearching = false }

        let resolved: PlaceResolveResponse
        do {
            resolved = try await api.resolvePlace(placeId: placeId, sessionToken: sessionToken)
        } catch {
            // Could not resolve — stay on default list.
            return
        }

        // Regenerate session token now that the session is closed.
        self.sessionToken = UUID().uuidString

        areaLabel = resolved.label
        seedState = .seeding

        // Kick off radius search and coverage ensure concurrently.
        async let initialResults = api.searchRestaurants(lat: resolved.lat, lng: resolved.lng)
        async let coverageResponse = api.ensureCoverage(lat: resolved.lat, lng: resolved.lng)

        do {
            radiusResults = try await initialResults
        } catch {
            radiusResults = []
        }

        let coverage: CoverageEnsureResponse
        do {
            coverage = try await coverageResponse
        } catch {
            seedState = .failed(error.localizedDescription)
            return
        }

        // If the server queued a seed job, poll it then re-fetch.
        if coverage.status == "queued", let jobID = coverage.jobID {
            seedPollTask?.cancel()
            seedPollTask = Task {
                await pollSeedJob(
                    jobID: jobID,
                    lat: resolved.lat,
                    lng: resolved.lng
                )
            }
        } else {
            // Already covered — seed is effectively done.
            seedState = .done
        }
    }

    private func pollSeedJob(jobID: UUID, lat: Double, lng: Double) async {
        let pollInterval: UInt64 = 4_000_000_000  // 4s in nanoseconds
        let maxAttempts = 23                       // ~92s cap

        for _ in 0 ..< maxAttempts {
            do {
                try await Task.sleep(nanoseconds: pollInterval)
            } catch {
                return // Task cancelled
            }
            guard !Task.isCancelled else { return }

            let status: CoverageJobStatus
            do {
                status = try await api.getCoverageJob(id: jobID)
            } catch {
                // Transient network error — keep polling.
                continue
            }

            if status.status == "succeeded" || status.status == "skipped" {
                // Refetch radius results now that new venues may be seeded.
                do {
                    radiusResults = try await api.searchRestaurants(lat: lat, lng: lng)
                } catch {
                    // Non-fatal — keep existing results.
                }
                seedState = .done
                return
            }

            if status.status == "failed" {
                seedState = .failed("Coverage seeding failed.")
                return
            }
            // Otherwise keep polling (status == "pending" / "running" / etc.)
        }

        // Timed out — treat as done so UI doesn't show "finding more" forever.
        seedState = .done
    }
}
