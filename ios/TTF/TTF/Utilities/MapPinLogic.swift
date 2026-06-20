import SwiftUI

enum MapPinKind: String {
    case confirmedTtf = "confirmed_ttf"
    case earlyTtf = "early_ttf"
    case ratings
    case notes
    case empty
}

enum MapPinLogic {
    static func kind(for entry: RestaurantMapEntry) -> MapPinKind {
        if entry.ttf.sampleSize >= 3 { return .confirmedTtf }
        if entry.ttf.sampleSize > 0 { return .earlyTtf }
        if entry.attributeRatingCount > 0 { return .ratings }
        if entry.noteCount > 0 { return .notes }
        return .empty
    }

    /// Tier color even for 1–2 TTF samples (preview before confidence threshold).
    static func previewTtfTier(for entry: RestaurantMapEntry) -> TtfTier {
        guard entry.ttf.sampleSize > 0, let median = entry.ttf.medianMinutes else {
            return .unknown
        }
        if median <= 8 { return .fast }
        if median <= 15 { return .ok }
        return .slow
    }

    static func fill(for entry: RestaurantMapEntry, searchFocus: Bool = false) -> Color {
        if searchFocus { return .pinSearchFocus }
        switch kind(for: entry) {
        case .confirmedTtf:
            return TtfTierLogic.tier(for: entry.ttf).color
        case .earlyTtf:
            return previewTtfTier(for: entry).color
        case .ratings:
            return .pinRatings
        case .notes:
            return .pinNotes
        case .empty:
            return .ttfUnknown
        }
    }

    static func label(for entry: RestaurantMapEntry) -> String? {
        if entry.ttf.sampleSize > 0, let median = entry.ttf.medianMinutes {
            return "\(Int(median.rounded()))m"
        }
        if entry.attributeRatingCount > 0 { return "★" }
        if entry.noteCount > 0 { return "💬" }
        return nil
    }

    static func tooltip(for entry: RestaurantMapEntry) -> String {
        var lines = [entry.name]

        if entry.ttf.sampleSize >= 3 {
            lines.append(
                "Speed: \(TtfTierLogic.formattedMedian(entry.ttf)) median (\(entry.ttf.sampleSize) visits) — \(TtfTierLogic.tier(for: entry.ttf).label)"
            )
        } else if entry.ttf.sampleSize > 0 {
            let visitWord = entry.ttf.sampleSize == 1 ? "visit" : "visits"
            lines.append(
                "Speed: \(TtfTierLogic.formattedMedian(entry.ttf)) from \(entry.ttf.sampleSize) \(visitWord) (need 3 for tier)"
            )
        } else {
            lines.append("Speed: no visits logged yet")
        }

        if entry.attributeRatingCount > 0 {
            let submissionWord = entry.attributeRatingCount == 1 ? "submission" : "submissions"
            lines.append("Parent ratings: \(entry.attributeRatingCount) \(submissionWord)")
        }
        if entry.noteCount > 0 {
            lines.append("Parent notes: \(entry.noteCount)")
        }
        if entry.ttf.sampleSize == 0, entry.attributeRatingCount == 0, entry.noteCount == 0 {
            lines.append("Be the first parent to contribute")
        }

        return lines.joined(separator: "\n")
    }

    static func hasBadges(for entry: RestaurantMapEntry) -> Bool {
        let pinKind = kind(for: entry)
        let showRatings = entry.attributeRatingCount > 0 && pinKind != .ratings
        let showNotes = entry.noteCount > 0 && pinKind != .notes
        return showRatings || showNotes
    }
}
