import AuthenticationServices
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
    private var pendingAppleSignInNonce: String?

    func configure() {
        if AppConfig.useAuthEmulator {
            Auth.auth().useEmulator(withHost: "localhost", port: 9099)
        }
        tokenListener = Auth.auth().addIDTokenDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                await self?.handleTokenChange(user: user)
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

    /// Configures a Sign in with Apple request with the Firebase nonce flow.
    @MainActor
    func prepareAppleSignIn(request: ASAuthorizationAppleIDRequest) {
        let nonce = AppleSignInNonce.random()
        pendingAppleSignInNonce = nonce
        request.requestedScopes = [.fullName, .email]
        request.nonce = AppleSignInNonce.sha256(nonce)
    }

    @MainActor
    func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) async {
        isLoading = true
        errorMessage = nil
        defer {
            isLoading = false
            pendingAppleSignInNonce = nil
        }

        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let nonce = pendingAppleSignInNonce,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8) else {
                errorMessage = "Apple Sign-In could not be completed."
                return
            }
            do {
                let firebaseCredential = OAuthProvider.appleCredential(
                    withIDToken: idToken,
                    rawNonce: nonce,
                    fullName: credential.fullName
                )
                try await Auth.auth().signIn(with: firebaseCredential)
            } catch {
                errorMessage = error.localizedDescription
            }
        case .failure(let error):
            let nsError = error as NSError
            if nsError.domain == ASAuthorizationError.errorDomain,
               nsError.code == ASAuthorizationError.canceled.rawValue {
                return
            }
            errorMessage = error.localizedDescription
        }
    }

    func signOut() {
        devTokenActive = false
        try? Auth.auth().signOut()
        idToken = nil
        profile = nil
        errorMessage = nil
        pendingAppleSignInNonce = nil
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
