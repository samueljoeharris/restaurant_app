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
    let watched: Bool

    enum CodingKeys: String, CodingKey {
        case id, name, address, lat, lng, ttf, watched
        case cuisineTags = "cuisine_tags"
        case pilotCity = "pilot_city"
        case noteCount = "note_count"
        case attributeRatingCount = "attribute_rating_count"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        address = try container.decode(String.self, forKey: .address)
        lat = try container.decode(Double.self, forKey: .lat)
        lng = try container.decode(Double.self, forKey: .lng)
        cuisineTags = try container.decode([String].self, forKey: .cuisineTags)
        pilotCity = try container.decode(String.self, forKey: .pilotCity)
        ttf = try container.decode(TtfAggregate.self, forKey: .ttf)
        noteCount = try container.decode(Int.self, forKey: .noteCount)
        attributeRatingCount = try container.decode(Int.self, forKey: .attributeRatingCount)
        watched = try container.decodeIfPresent(Bool.self, forKey: .watched) ?? false
    }
}

struct RestaurantDetailResponse: Codable, Hashable {
    let restaurant: RestaurantDetail
    let ttf: TtfAggregate
}

struct PlacePracticalResponse: Codable, Hashable {
    let placeId: String
    let openNow: Bool?
    let hoursSummary: String?
    let weekdayHours: [String]?
    let phone: String?
    let website: String?
    let googleMapsUrl: String?
    let googleRating: Double?
    let googleRatingCount: Int?
    let businessStatus: String?

    enum CodingKeys: String, CodingKey {
        case placeId = "place_id"
        case openNow = "open_now"
        case hoursSummary = "hours_summary"
        case weekdayHours = "weekday_hours"
        case phone, website
        case googleMapsUrl = "google_maps_url"
        case googleRating = "google_rating"
        case googleRatingCount = "google_rating_count"
        case businessStatus = "business_status"
    }
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
