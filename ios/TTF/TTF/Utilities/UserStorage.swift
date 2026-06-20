import Foundation

enum UserStorage {
    private static let inboxLastSeenKey = "ttf.inboxLastSeen"
    private static let pushPrimeKey = "ttf.pushPrimeShown"

    static var inboxLastSeen: String? {
        get { UserDefaults.standard.string(forKey: inboxLastSeenKey) }
        set { UserDefaults.standard.set(newValue, forKey: inboxLastSeenKey) }
    }

    static var pushPrimeShown: Bool {
        get { UserDefaults.standard.bool(forKey: pushPrimeKey) }
        set { UserDefaults.standard.set(newValue, forKey: pushPrimeKey) }
    }
}
