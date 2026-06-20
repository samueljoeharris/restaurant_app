import Foundation

enum PlacePracticalCache {
    private static let ttl: TimeInterval = 5 * 60
    private static var entries: [String: (data: PlacePracticalResponse, expiresAt: Date)] = [:]

    static func get(_ placeId: String) -> PlacePracticalResponse? {
        guard let entry = entries[placeId], entry.expiresAt > Date() else {
            entries.removeValue(forKey: placeId)
            return nil
        }
        return entry.data
    }

    static func set(_ placeId: String, data: PlacePracticalResponse) {
        entries[placeId] = (data, Date().addingTimeInterval(ttl))
    }
}
