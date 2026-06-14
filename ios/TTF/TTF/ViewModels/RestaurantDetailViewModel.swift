import Foundation
import Observation

@Observable
final class RestaurantDetailViewModel {
    let restaurantID: UUID

    private(set) var detail: RestaurantDetailResponse?
    private(set) var notes: [RestaurantNote] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    init(restaurantID: UUID) {
        self.restaurantID = restaurantID
    }

    @MainActor
    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            async let detailTask = api.getRestaurant(id: restaurantID)
            async let notesTask = api.listNotes(restaurantID: restaurantID)
            detail = try await detailTask
            notes = try await notesTask
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
