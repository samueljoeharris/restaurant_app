import Foundation
import Observation

@Observable
final class MapViewModel {
    private(set) var entries: [RestaurantMapEntry] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    @MainActor
    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            entries = try await api.listRestaurantsForMap()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
