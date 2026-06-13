import SwiftUI

struct AccountView: View {
    @Environment(AuthService.self) private var auth
    @Environment(APIClient.self) private var api
    @State private var viewModel = AuthViewModel()
    @State private var healthMessage: String?

    var body: some View {
        Group {
            if auth.isSignedIn {
                signedInContent
            } else {
                SignInView()
            }
        }
        .navigationTitle("Account")
        .task {
            if auth.isSignedIn, auth.profile == nil {
                await viewModel.refreshProfile(api: api, auth: auth)
            }
        }
    }

    @ViewBuilder
    private var signedInContent: some View {
        List {
            Section("Profile") {
                if viewModel.isRefreshingProfile && auth.profile == nil {
                    ProgressView()
                } else if let profile = auth.profile {
                    LabeledContent("Name", value: profile.displayName ?? "—")
                    LabeledContent("Email", value: profile.email ?? "—")
                    LabeledContent("Contributions", value: "\(profile.contributionCount)")
                } else if let error = viewModel.profileError {
                    Text(error).foregroundStyle(.red)
                }
            }

            Section("API") {
                LabeledContent("Base URL", value: AppConfig.apiBaseURL.absoluteString)
                if let healthMessage {
                    Text(healthMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Button("Ping API") {
                    Task {
                        do {
                            let health = try await api.health()
                            healthMessage = "\(health.status) · \(health.pilotDisplayName)"
                        } catch {
                            healthMessage = error.localizedDescription
                        }
                    }
                }
            }

            Section {
                Button("Sign out", role: .destructive) {
                    auth.signOut()
                    healthMessage = nil
                }
            }
        }
    }
}
