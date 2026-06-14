import Foundation

enum TtfItemType: String, CaseIterable, Codable, Identifiable {
    case fries
    case appleSlices = "apple_slices"
    case bread
    case kidsMeal = "kids_meal"
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .fries: "Fries"
        case .appleSlices: "Apple slices"
        case .bread: "Bread"
        case .kidsMeal: "Kids meal"
        case .other: "Other"
        }
    }

    var emoji: String {
        switch self {
        case .fries: "🍟"
        case .appleSlices: "🍎"
        case .bread: "🍞"
        case .kidsMeal: "🧒"
        case .other: "🍽️"
        }
    }
}

enum TtfPortionSize: String, CaseIterable, Codable, Identifiable {
    case kid
    case regular
    case shareable

    var id: String { rawValue }

    var label: String {
        switch self {
        case .kid: "Kid"
        case .regular: "Regular"
        case .shareable: "Shareable"
        }
    }
}

enum TtfDaypart: String, CaseIterable, Codable, Identifiable {
    case breakfast
    case lunch
    case dinner
    case late

    var id: String { rawValue }

    var label: String {
        rawValue.capitalized
    }

    static func current() -> TtfDaypart {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 11 { return .breakfast }
        if hour < 15 { return .lunch }
        if hour < 21 { return .dinner }
        return .late
    }
}

struct TtfSubmission: Encodable {
    let elapsedMinutes: Int
    let itemType: TtfItemType
    let itemQuality: Int
    let portionSize: TtfPortionSize
    let daypart: TtfDaypart
    let partySizeKids: Int
    let waitContext: String?

    enum CodingKeys: String, CodingKey {
        case elapsedMinutes = "elapsed_minutes"
        case itemType = "item_type"
        case itemQuality = "item_quality"
        case portionSize = "portion_size"
        case daypart
        case partySizeKids = "party_size_kids"
        case waitContext = "wait_context"
    }
}

struct TtfSubmissionResponse: Decodable {
    let id: UUID
    let elapsedMinutes: Int
    let itemType: String
    let itemQuality: Int

    enum CodingKeys: String, CodingKey {
        case id
        case elapsedMinutes = "elapsed_minutes"
        case itemType = "item_type"
        case itemQuality = "item_quality"
    }
}
