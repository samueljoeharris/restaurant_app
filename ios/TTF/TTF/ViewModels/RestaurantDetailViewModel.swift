import Foundation
import Observation

@Observable
final class RestaurantDetailViewModel {
    let restaurantID: UUID

    private(set) var detail: RestaurantDetailResponse?
    private(set) var notes: [RestaurantNote] = []
    private(set) var practical: PlacePracticalResponse?
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    init(restaurantID: UUID) {
        self.restaurantID = restaurantID
    }

    @MainActor
    func load(api: APIClient, fetchPractical: Bool = false) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            async let detailTask = api.getRestaurant(id: restaurantID)
            async let notesTask = api.listNotes(restaurantID: restaurantID)
            detail = try await detailTask
            notes = try await notesTask
            if fetchPractical, let placeId = detail?.restaurant.googlePlaceId {
                practical = try? await api.getPlacePractical(placeId: placeId)
            } else {
                practical = nil
            }
        } catch {
            errorMessage = (error as? APIError)?.userFacingMessage ?? error.localizedDescription
        }
    }
}
