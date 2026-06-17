import FirebaseAppCheck
import Foundation

/// Gates App Check provider setup behind `TTF_APP_CHECK_ENABLED` until the iOS app
/// is registered in Firebase Console. Must run before `FirebaseApp.configure()`.
enum AppCheckService {
    static func configureIfEnabled() {
        guard AppConfig.appCheckEnabled else { return }
        AppCheck.setAppCheckProviderFactory(TTFAppCheckProviderFactory())
    }
}
