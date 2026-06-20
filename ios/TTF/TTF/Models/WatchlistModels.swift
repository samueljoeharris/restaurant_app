import Foundation

struct NotificationPreferences: Codable, Hashable {
    let cadence: String
    let quietHoursStart: String
    let quietHoursEnd: String
    let alertNewTtf: Bool
    let alertNewRating: Bool
    let alertNewNote: Bool
    let alertEveryReview: Bool
    let pushEnabled: Bool

    enum CodingKeys: String, CodingKey {
        case cadence
        case quietHoursStart = "quiet_hours_start"
        case quietHoursEnd = "quiet_hours_end"
        case alertNewTtf = "alert_new_ttf"
        case alertNewRating = "alert_new_rating"
        case alertNewNote = "alert_new_note"
        case alertEveryReview = "alert_every_review"
        case pushEnabled = "push_enabled"
    }
}

struct ExtendedUserProfile: Codable, Hashable {
    let firebaseUid: String
    let displayName: String?
    let email: String?
    let contributionCount: Int
    let role: String?
    let kidsAges: [Int]
    let watchCount: Int
    let unreadActivityCount: Int
    let onboardingCompleted: Bool
    let notificationPreferences: NotificationPreferences

    enum CodingKeys: String, CodingKey {
        case email, role
        case firebaseUid = "firebase_uid"
        case displayName = "display_name"
        case contributionCount = "contribution_count"
        case kidsAges = "kids_ages"
        case watchCount = "watch_count"
        case unreadActivityCount = "unread_activity_count"
        case onboardingCompleted = "onboarding_completed"
        case notificationPreferences = "notification_preferences"
    }
}

struct WatchedRestaurantEntry: Codable, Identifiable, Hashable {
    var id: UUID { restaurant.id ?? UUID() }
    let restaurant: RestaurantMapEntry
    let watchedAt: Date

    enum CodingKeys: String, CodingKey {
        case restaurant
        case watchedAt = "watched_at"
    }
}

struct WatchedRestaurantsResponse: Codable, Hashable {
    let items: [WatchedRestaurantEntry]
    let total: Int
    let limit: Int
    let offset: Int
}

struct ActivityEventItem: Codable, Identifiable, Hashable {
    let id: UUID
    let restaurantId: UUID
    let restaurantName: String
    let eventType: String
    let sourceId: UUID
    let headline: String
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, headline
        case restaurantId = "restaurant_id"
        case restaurantName = "restaurant_name"
        case eventType = "event_type"
        case sourceId = "source_id"
        case createdAt = "created_at"
    }
}

struct ActivityInboxResponse: Codable, Hashable {
    let items: [ActivityEventItem]
    let total: Int
    let unreadCount: Int

    enum CodingKeys: String, CodingKey {
        case items, total
        case unreadCount = "unread_count"
    }
}

struct UnreadCountResponse: Codable, Hashable {
    let unreadCount: Int

    enum CodingKeys: String, CodingKey {
        case unreadCount = "unread_count"
    }
}
