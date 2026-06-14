import Foundation

enum AppConfig {
    /// Dedham, MA — pilot city center for initial map region.
    static let pilotCenterLatitude = 42.2418
    static let pilotCenterLongitude = -71.1762
    static let pilotDisplayName = "Dedham, Massachusetts"

    static var apiBaseURL: URL {
        if let plist = Bundle.main.object(forInfoDictionaryKey: "TTFAPIURL") as? String,
           !plist.isEmpty,
           !plist.hasPrefix("$("),
           let url = URL(string: plist) {
            return url
        }
        if let override = ProcessInfo.processInfo.environment["TTF_API_URL"],
           let url = URL(string: override) {
            return url
        }
        return URL(string: "https://api.dev.littlescout.app")!
    }
}
