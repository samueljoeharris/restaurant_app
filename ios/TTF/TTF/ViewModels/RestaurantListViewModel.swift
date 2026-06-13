import Foundation
import Observation

@Observable
final class RestaurantListViewModel {
    private(set) var restaurants: [RestaurantSummary] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    var searchQuery = ""

    @MainActor
    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            restaurants = try await api.listRestaurants(query: searchQuery.isEmpty ? nil : searchQuery)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
