import SwiftUI

enum TtfTier: String, CaseIterable {
    case fast
    case ok
    case slow
    case unknown

    var label: String {
        switch self {
        case .fast: "Fast (≤8 min)"
        case .ok: "OK (9–15 min)"
        case .slow: "Slow (>15 min)"
        case .unknown: "Not enough data"
        }
    }

    var color: Color {
        switch self {
        case .fast: Color(red: 0.176, green: 0.561, blue: 0.306)
        case .ok: Color(red: 0.831, green: 0.627, blue: 0.090)
        case .slow: Color(red: 0.753, green: 0.224, blue: 0.169)
        case .unknown: Color(red: 0.612, green: 0.639, blue: 0.686)
        }
    }
}

enum TtfTierLogic {
    static func tier(for ttf: TtfAggregate) -> TtfTier {
        guard ttf.sampleSize >= 3, let median = ttf.medianMinutes else {
            return .unknown
        }
        if median <= 8 { return .fast }
        if median <= 15 { return .ok }
        return .slow
    }

    static func formattedMedian(_ ttf: TtfAggregate) -> String {
        guard ttf.sampleSize > 0, let median = ttf.medianMinutes else {
            return "—"
        }
        return "\(Int(median.rounded())) min"
    }
}
