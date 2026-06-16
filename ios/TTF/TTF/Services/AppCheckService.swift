import FirebaseAppCheck
import FirebaseCore
import Foundation

/// App Check scaffolding for iOS (App Attest in release, debug provider in DEBUG).
/// Disabled by default via `TTF_APP_CHECK_ENABLED` until Firebase Console registers the iOS app.
enum AppCheckService {
  private final class AppAttestProviderFactory: NSObject, AppCheckProviderFactory {
    func createProvider(with app: FirebaseApp) -> AppCheckProvider? {
      AppAttestProvider(app: app)
    }
  }

  /// Must run before `FirebaseApp.configure()`.
  static func configureIfEnabled() {
    guard AppConfig.appCheckEnabled else { return }

    #if DEBUG
    AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
    #else
    AppCheck.setAppCheckProviderFactory(AppAttestProviderFactory())
    #endif
  }

  static func token() async -> String? {
    guard AppConfig.appCheckEnabled else { return nil }
    do {
      let result = try await AppCheck.appCheck().token(forcingRefresh: false)
      return result.token
    } catch {
      return nil
    }
  }
}
