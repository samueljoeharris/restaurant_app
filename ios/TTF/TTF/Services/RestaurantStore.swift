import Foundation
import Observation

/// Shared restaurant cache — one network fetch for map + list tabs.
@Observable
final class RestaurantStore {
    private(set) var mapEntries: [RestaurantMapEntry] = [] {
        didSet {
            entriesByID = Dictionary(uniqueKeysWithValues: mapEntries.map { ($0.id, $0) })
            summaries = mapEntries.map(RestaurantSummary.init(from:))
        }
    }
    private var entriesByID: [UUID: RestaurantMapEntry] = [:]
    private(set) var summaries: [RestaurantSummary] = []
    private(set) var isLoading = false
    private(set) var isRefreshing = false
    private(set) var errorMessage: String?
    private(set) var lastLoadedAt: Date?

    var isEmpty: Bool { mapEntries.isEmpty }

    func filteredSummaries(matching query: String) -> [RestaurantSummary] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return summaries }
        return summaries.filter { $0.name.localizedCaseInsensitiveContains(trimmed) }
    }

    func entry(for id: UUID) -> RestaurantMapEntry? {
        entriesByID[id]
    }

    /// Load once and reuse across tabs. Pass `force: true` to pull fresh data.
    @MainActor
    func load(api: APIClient, force: Bool = false) async {
        if isLoading { return }
        if !force, !mapEntries.isEmpty { return }

        let refreshing = !mapEntries.isEmpty
        if refreshing {
            isRefreshing = true
        } else {
            isLoading = true
        }
        errorMessage = nil
        defer {
            isLoading = false
            isRefreshing = false
        }

        do {
            Task { try? await api.health() }
            mapEntries = try await api.listRestaurantsForMap()
            lastLoadedAt = Date()
        } catch {
            if mapEntries.isEmpty {
                errorMessage = error.localizedDescription
            }
        }
    }

    @MainActor
    func refresh(api: APIClient) async {
        await load(api: api, force: true)
    }
}

extension RestaurantSummary {
    init(from entry: RestaurantMapEntry) {
        self.init(
            id: entry.id,
            name: entry.name,
            address: entry.address,
            lat: entry.lat,
            lng: entry.lng,
            cuisineTags: entry.cuisineTags,
            pilotCity: entry.pilotCity
        )
    }
}
