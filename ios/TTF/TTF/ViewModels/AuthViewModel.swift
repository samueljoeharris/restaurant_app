import Foundation
import Observation

@Observable
final class AuthViewModel {
    private(set) var isRefreshingProfile = false
    private(set) var profileError: String?

    @MainActor
    func refreshProfile(api: APIClient, auth: AuthService) async {
        guard auth.isSignedIn else { return }
        isRefreshingProfile = true
        profileError = nil
        defer { isRefreshingProfile = false }

        do {
            let profile = try await api.getMe()
            auth.updateProfile(profile)
        } catch {
            profileError = error.localizedDescription
        }
    }
}
