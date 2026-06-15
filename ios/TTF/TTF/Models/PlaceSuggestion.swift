import Foundation

struct PlaceSuggestion: Codable, Identifiable, Hashable {
    let type: String
    let placeId: String?
    let restaurantId: String?
    let primaryText: String
    let secondaryText: String

    /// Stable identity for SwiftUI lists.
    var id: String {
        if let rid = restaurantId { return "restaurant:\(rid)" }
        if let pid = placeId { return "place:\(pid)" }
        return "unknown:\(primaryText)"
    }

    enum CodingKeys: String, CodingKey {
        case type
        case placeId = "place_id"
        case restaurantId = "restaurant_id"
        case primaryText = "primary_text"
        case secondaryText = "secondary_text"
    }
}

struct AutocompleteResponse: Codable {
    let suggestions: [PlaceSuggestion]
}

struct PlaceResolveResponse: Codable {
    let placeId: String
    let lat: Double
    let lng: Double
    let label: String

    enum CodingKeys: String, CodingKey {
        case placeId = "place_id"
        case lat
        case lng
        case label
    }
}
