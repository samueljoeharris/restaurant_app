import FirebaseAppCheck
import FirebaseAuth
import Foundation
import Observation

@Observable
final class AuthService {
    private(set) var idToken: String?
    private(set) var profile: UserProfile?
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    var isSignedIn: Bool { idToken != nil }

    private var devTokenActive = false
    private var tokenListener: AuthStateDidChangeListenerHandle?

    func configure() {
        if AppConfig.useAuthEmulator {
            Auth.auth().useEmulator(withHost: "localhost", port: 9099)
        }
        tokenListener = Auth.auth().addIDTokenDidChangeListener { [weak self] _, user in
            guard let self else { return }
            Task { @MainActor in
                await self.handleTokenChange(user: user)
            }
        }
        bootstrapDevTokenIfNeeded()
    }

    @MainActor
    private func handleTokenChange(user: FirebaseAuth.User?) async {
        if let user {
            idToken = try? await user.getIDToken()
        } else if !devTokenActive {
            idToken = nil
            profile = nil
        }
    }

    /// Returns a fresh ID token for authenticated API requests.
    /// Firebase returns the cached token if valid, or refreshes it if near expiry.
    func freshIDToken() async throws -> String {
        if let token = idToken, token.hasPrefix("dev:") {
            return token
        }
        guard let user = Auth.auth().currentUser else {
            throw APIError.unauthorized
        }
        return try await user.getIDToken()
    }

    func appCheckToken() async -> String? {
        do {
            let result = try await AppCheck.appCheck().token(forcingRefresh: false)
            return result.token
        } catch {
            return nil
        }
    }

    @MainActor
    func signIn(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await Auth.auth().signIn(withEmail: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func signUp(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await Auth.auth().createUser(withEmail: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    func signInWithApple() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let coordinator = AppleSignInCoordinator()
            let result = try await coordinator.signIn()
            let credential = OAuthProvider.appleCredential(
                withIDToken: result.idToken,
                rawNonce: result.rawNonce,
                fullName: result.fullName
            )
            try await Auth.auth().signIn(with: credential)
        } catch AppleSignInError.canceled {
            // User canceled — leave errorMessage nil (no scary banner).
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() {
        devTokenActive = false
        try? Auth.auth().signOut()
        idToken = nil
        profile = nil
        errorMessage = nil
    }

    func updateProfile(_ profile: UserProfile) {
        self.profile = profile
    }

    /// Bootstraps a dev token from the TTF_DEV_TOKEN scheme environment variable.
    /// Used with AUTH_DEV_MODE=true API to bypass Firebase when no GoogleService-Info.plist is available.
    func bootstrapDevTokenIfNeeded() {
        guard idToken == nil,
              let token = ProcessInfo.processInfo.environment["TTF_DEV_TOKEN"],
              !token.isEmpty else { return }
        idToken = token
        devTokenActive = true
    }
}
