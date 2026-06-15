import Foundation
import Observation

/// Shared restaurant cache — one network fetch for map + list tabs.
@Observable
@MainActor
final class RestaurantStore {
    private(set) var mapEntries: [RestaurantMapEntry] = []
    /// Derived from `mapEntries` once per load (rather than recomputed on every
    /// access) so list filtering doesn't re-map the whole catalog per keystroke.
    private(set) var summaries: [RestaurantSummary] = []
    private(set) var isLoading = false
    private(set) var isRefreshing = false
    private(set) var errorMessage: String?
    private(set) var lastLoadedAt: Date?

    var isEmpty: Bool { mapEntries.isEmpty }

    func filteredSummaries(matching query: String) -> [RestaurantSummary] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return summaries }
        return summaries.filter { summary in
            summary.name.localizedCaseInsensitiveContains(trimmed)
                || summary.address.localizedCaseInsensitiveContains(trimmed)
                || summary.cuisineTags.contains { $0.localizedCaseInsensitiveContains(trimmed) }
        }
    }

    func entry(for id: UUID) -> RestaurantMapEntry? {
        mapEntries.first { $0.id == id }
    }

    /// Load once and reuse across tabs. Pass `force: true` to pull fresh data.
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
            // Warm Cloud Run while fetching (helps first-launch cold starts).
            async let warm = try? await api.health()
            async let fetch = api.listRestaurantsForMap()
            _ = await warm
            mapEntries = try await fetch
            summaries = mapEntries.map(RestaurantSummary.init(from:))
            lastLoadedAt = Date()
        } catch {
            if mapEntries.isEmpty {
                errorMessage = error.localizedDescription
            }
        }
    }

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
