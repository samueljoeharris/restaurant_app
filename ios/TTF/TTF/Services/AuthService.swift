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

    var hasAppleProvider: Bool {
        Auth.auth().currentUser?.providerData.contains { $0.providerID == "apple.com" } ?? false
    }

    var hasPasswordProvider: Bool {
        Auth.auth().currentUser?.providerData.contains { $0.providerID == "password" } ?? false
    }

    func clearError() {
        errorMessage = nil
    }

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
    func freshIDToken(forceRefresh: Bool = false) async throws -> String {
        if let token = idToken, token.hasPrefix("dev:") {
            return token
        }
        guard let user = Auth.auth().currentUser else {
            throw APIError.unauthorized
        }
        return try await user.getIDToken(forcingRefresh: forceRefresh)
    }

    func appCheckToken() async -> String? {
        guard AppConfig.appCheckEnabled else { return nil }
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
            let result = try await performAppleSignIn()
            try await Auth.auth().signIn(with: result.credential)
        } catch AppleSignInError.canceled {
            // User canceled — leave errorMessage nil (no scary banner).
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    struct AppleReauthResult {
        let authorizationCode: String?
    }

    /// Re-authenticate the current user with Apple and return a fresh authorization code for server-side token revoke.
    @MainActor
    func reauthenticateWithApple() async throws -> AppleReauthResult {
        guard let user = Auth.auth().currentUser else {
            throw APIError.unauthorized
        }
        let result = try await performAppleSignIn()
        try await user.reauthenticate(with: result.credential)
        idToken = try await user.getIDToken(forcingRefresh: true)
        return AppleReauthResult(authorizationCode: result.authorizationCode)
    }

    @MainActor
    func reauthenticateWithEmailPassword(email: String, password: String) async throws {
        guard let user = Auth.auth().currentUser else {
            throw APIError.unauthorized
        }
        let credential = EmailAuthProvider.credential(withEmail: email, password: password)
        try await user.reauthenticate(with: credential)
        idToken = try await user.getIDToken(forcingRefresh: true)
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
    func bootstrapDevTokenIfNeeded() {
        guard idToken == nil,
              let token = ProcessInfo.processInfo.environment["TTF_DEV_TOKEN"],
              !token.isEmpty else { return }
        idToken = token
        devTokenActive = true
    }

    private struct AppleSignInPayload {
        let credential: AuthCredential
        let authorizationCode: String?
    }

    @MainActor
    private func performAppleSignIn() async throws -> AppleSignInPayload {
        let coordinator = AppleSignInCoordinator()
        let result = try await coordinator.signIn()
        let credential = OAuthProvider.appleCredential(
            withIDToken: result.idToken,
            rawNonce: result.rawNonce,
            fullName: result.fullName
        )
        return AppleSignInPayload(
            credential: credential,
            authorizationCode: result.authorizationCode
        )
    }
}
