import FirebaseAppCheck
import FirebaseCore
import Foundation

/// Supplies App Attest in release and a debug provider in DEBUG so simulator
/// builds still get a token. Install BEFORE FirebaseApp.configure().
final class TTFAppCheckProviderFactory: NSObject, AppCheckProviderFactory {
    func createProvider(with app: FirebaseApp) -> AppCheckProvider? {
        #if DEBUG
        return AppCheckDebugProvider(app: app)
        #else
        if #available(iOS 14.0, *) {
            return AppAttestProvider(app: app)
        }
        return DeviceCheckProvider(app: app)
        #endif
    }
}
