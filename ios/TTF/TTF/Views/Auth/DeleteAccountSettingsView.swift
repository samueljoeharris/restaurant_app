import FirebaseAuth
import SwiftUI

private enum DeleteStep {
    case idle
    case confirm
    case reauth
}

@MainActor
struct DeleteAccountSettingsView: View {
    @Environment(AuthService.self) private var auth
    @Environment(APIClient.self) private var api
    @Environment(RestaurantStore.self) private var store

    @State private var step: DeleteStep = .idle
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isBusy = false

    var body: some View {
        Group {
            switch step {
            case .idle:
                idleContent
            case .confirm:
                confirmContent
            case .reauth:
                reauthContent
            }
        }
    }

    private var idleContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(
                "Permanently remove your account and all contributions. This cannot be undone."
            )
            .font(.footnote)
            .foregroundStyle(.secondary)

            Button("Delete account", role: .destructive) {
                step = .confirm
                errorMessage = nil
            }
        }
    }

    private var confirmContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(
                "This permanently deletes your Little Scout account and all contributions "
                    + "(TTF observations, attribute ratings, and notes). Restaurant listings "
                    + "stay, but your data is removed from their aggregates."
            )
            .font(.footnote)
            .foregroundStyle(.secondary)

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            HStack {
                Button(role: .destructive) {
                    Task { await deleteWithFreshToken() }
                } label: {
                    Text(isBusy ? "Deleting…" : "Delete my account")
                }
                .disabled(isBusy)

                Button("Cancel") {
                    resetFlow()
                }
                .disabled(isBusy)
            }
        }
    }

    private var reauthContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Confirm it is you before we delete your account.")
                .font(.footnote)
                .foregroundStyle(.secondary)

            if auth.hasPassword {
                SecureField("Current password", text: $password)
                    .textContentType(.password)
                    .textFieldStyle(.roundedBorder)

                Button(isBusy ? "…" : "Confirm identity") {
                    Task { await reauthWithPassword() }
                }
                .disabled(isBusy || password.isEmpty)
            } else if auth.hasAppleProvider {
                Button(isBusy ? "…" : "Confirm with Apple") {
                    Task { await reauthWithAppleAndDelete() }
                }
                .disabled(isBusy)
            } else {
                Text("Sign out and back in, then try deleting your account again.")
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Button("Cancel") {
                resetFlow()
            }
            .disabled(isBusy)
        }
    }

    private func resetFlow() {
        step = .idle
        password = ""
        errorMessage = nil
    }

    private func deleteWithFreshToken(appleAuthorizationCode: String? = nil) async {
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }

        do {
            try await api.deleteAccount(appleAuthorizationCode: appleAuthorizationCode)
            finishAfterDelete()
        } catch let error as APIError {
            if case .httpStatus(403, _) = error {
                step = .reauth
                errorMessage = error.userFacingMessage
                return
            }
            errorMessage = error.userFacingMessage
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func reauthWithPassword() async {
        guard let email = auth.profile?.email ?? Auth.auth().currentUser?.email else {
            errorMessage = "Could not determine your email address."
            return
        }
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }

        do {
            try await auth.reauthenticateWithEmailPassword(email: email, password: password)
            await deleteWithFreshToken()
        } catch {
            errorMessage = (error as? APIError)?.userFacingMessage ?? error.localizedDescription
        }
    }

    private func reauthWithAppleAndDelete() async {
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }

        do {
            let result = try await auth.reauthenticateWithApple()
            await deleteWithFreshToken(appleAuthorizationCode: result.authorizationCode)
        } catch AppleSignInError.canceled {
            errorMessage = nil
        } catch {
            errorMessage = (error as? APIError)?.userFacingMessage ?? error.localizedDescription
        }
    }

    private func finishAfterDelete() {
        store.clearCache()
        URLCache.shared.removeAllCachedResponses()
        auth.signOut()
        resetFlow()
    }
}
