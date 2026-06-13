import Foundation

struct RestaurantSummary: Codable, Identifiable, Hashable {
    let id: UUID
    let name: String
    let address: String
    let lat: Double
    let lng: Double
    let cuisineTags: [String]
    let pilotCity: String

    enum CodingKeys: String, CodingKey {
        case id, name, address, lat, lng
        case cuisineTags = "cuisine_tags"
        case pilotCity = "pilot_city"
    }
}

struct RestaurantDetail: Codable, Identifiable, Hashable {
    let id: UUID
    let name: String
    let address: String
    let lat: Double
    let lng: Double
    let cuisineTags: [String]
    let pilotCity: String
    let googlePlaceId: String?
    let googleMapsUrl: String?
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id, name, address, lat, lng
        case cuisineTags = "cuisine_tags"
        case pilotCity = "pilot_city"
        case googlePlaceId = "google_place_id"
        case googleMapsUrl = "google_maps_url"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct TtfAggregate: Codable, Hashable {
    let sampleSize: Int
    let medianMinutes: Double?
    let avgQuality: Double?
    let lastUpdated: Date?

    enum CodingKeys: String, CodingKey {
        case sampleSize = "sample_size"
        case medianMinutes = "median_minutes"
        case avgQuality = "avg_quality"
        case lastUpdated = "last_updated"
    }

    static let empty = TtfAggregate(
        sampleSize: 0,
        medianMinutes: nil,
        avgQuality: nil,
        lastUpdated: nil
    )
}

struct RestaurantMapEntry: Codable, Identifiable, Hashable {
    let id: UUID
    let name: String
    let address: String
    let lat: Double
    let lng: Double
    let cuisineTags: [String]
    let pilotCity: String
    let ttf: TtfAggregate
    let noteCount: Int
    let attributeRatingCount: Int

    enum CodingKeys: String, CodingKey {
        case id, name, address, lat, lng, ttf
        case cuisineTags = "cuisine_tags"
        case pilotCity = "pilot_city"
        case noteCount = "note_count"
        case attributeRatingCount = "attribute_rating_count"
    }
}

struct RestaurantDetailResponse: Codable, Hashable {
    let restaurant: RestaurantDetail
    let ttf: TtfAggregate
}

struct HealthResponse: Codable {
    let status: String
    let pilotCity: String
    let pilotDisplayName: String

    enum CodingKeys: String, CodingKey {
        case status
        case pilotCity = "pilot_city"
        case pilotDisplayName = "pilot_display_name"
    }
}
