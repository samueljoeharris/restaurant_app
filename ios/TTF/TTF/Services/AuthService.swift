import Foundation
import Observation

/// Firebase Auth + Sign in with Apple — wire up in Phase 3 after adding the Firebase iOS SDK.
@Observable
final class AuthService {
    private(set) var idToken: String?
    private(set) var profile: UserProfile?
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    var isSignedIn: Bool { idToken != nil }

    /// Dev-only: set `TTF_DEV_TOKEN` in the scheme environment (e.g. from the Firebase emulator script).
    func bootstrapDevTokenIfNeeded() {
        guard idToken == nil,
              let token = ProcessInfo.processInfo.environment["TTF_DEV_TOKEN"],
              !token.isEmpty else {
            return
        }
        idToken = token
    }

    func signInWithApple() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        // TODO(Phase 3): Firebase Auth + ASAuthorizationAppleIDProvider
        errorMessage = "Apple Sign-In is not wired up yet. Add FirebaseAuth via SPM, then implement SignInViewModel.signInWithApple()."
    }

    func signOut() {
        idToken = nil
        profile = nil
        errorMessage = nil
    }

    func updateProfile(_ profile: UserProfile) {
        self.profile = profile
    }
}
