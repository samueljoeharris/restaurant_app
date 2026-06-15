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
    private(set) var suggestions: [PlaceSuggestion] = []
    private(set) var isSearching = false
    private(set) var radiusResults: [RestaurantMapEntry] = []
    private(set) var areaLabel: String?
    private(set) var seedState: SeedState = .idle
    private(set) var selectedRestaurantID: UUID?

    /// True while a place label is shown but coordinates are still resolving.
    var isPendingPlaceMode: Bool {
        areaLabel != nil && pendingPlaceId != nil && resolvedLat == nil
    }

    var sessionToken: String = UUID().uuidString

    private var pendingPlaceId: String?
    private var pendingSessionToken: String?
    private var resolvedLat: Double?
    private var resolvedLng: Double?

    private var debounceTask: Task<Void, Never>?
    private var resolveTask: Task<Void, Never>?

    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

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
                try await Task.sleep(nanoseconds: 250_000_000)
            } catch {
                return
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
            suggestions = []
        }
    }

    func select(_ suggestion: PlaceSuggestion) {
        debounceTask?.cancel()
        suggestions = []

        if suggestion.type == "restaurant",
           let rid = suggestion.restaurantId,
           let uuid = UUID(uuidString: rid) {
            selectedRestaurantID = uuid
            seedRestaurantIfPossible(suggestion)
            return
        }

        guard let placeId = suggestion.placeId else { return }
        let token = sessionToken
        sessionToken = UUID().uuidString

        pendingPlaceId = placeId
        pendingSessionToken = token
        areaLabel = suggestion.primaryText
        resolvedLat = nil
        resolvedLng = nil
        radiusResults = []
        seedState = .idle

        resolveTask?.cancel()
        resolveTask = Task {
            await resolvePendingPlace()
        }
    }

    func clearAreaSearch() {
        resolveTask?.cancel()
        radiusResults = []
        areaLabel = nil
        pendingPlaceId = nil
        pendingSessionToken = nil
        resolvedLat = nil
        resolvedLng = nil
        seedState = .idle
        selectedRestaurantID = nil
        sessionToken = UUID().uuidString
    }

    func clearSelectedRestaurant() {
        selectedRestaurantID = nil
    }

    private func seedRestaurantIfPossible(_ suggestion: PlaceSuggestion) {
        guard let lat = suggestion.lat, let lng = suggestion.lng else { return }
        BackgroundCoverage.run(
            api: api,
            lat: lat,
            lng: lng,
            radiusM: BackgroundCoverage.restaurantSeedRadiusM
        )
    }

    private func resolvePendingPlace() async {
        guard let placeId = pendingPlaceId, let token = pendingSessionToken else { return }

        let resolved: PlaceResolveResponse
        do {
            resolved = try await api.resolvePlace(placeId: placeId, sessionToken: token)
        } catch {
            seedState = .failed("Could not resolve place.")
            clearAreaSearch()
            return
        }

        pendingPlaceId = nil
        pendingSessionToken = nil
        resolvedLat = resolved.lat
        resolvedLng = resolved.lng
        areaLabel = resolved.label
        seedState = .seeding

        do {
            radiusResults = try await api.searchRestaurants(lat: resolved.lat, lng: resolved.lng)
        } catch {
            radiusResults = []
        }

        let lat = resolved.lat
        let lng = resolved.lng
        BackgroundCoverage.run(
            api: api,
            lat: lat,
            lng: lng,
            radiusM: BackgroundCoverage.defaultSearchRadiusM
        ) { [weak self] in
            guard let self else { return }
            do {
                radiusResults = try await api.searchRestaurants(lat: lat, lng: lng)
            } catch {
                // Keep existing results.
            }
            seedState = .done
        }
    }
}
