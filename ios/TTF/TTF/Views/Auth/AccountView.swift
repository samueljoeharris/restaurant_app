import SwiftUI

struct AccountView: View {
    @Environment(AuthService.self) private var auth
    @Environment(APIClient.self) private var api
    @Environment(RestaurantStore.self) private var store
    @State private var viewModel = AuthViewModel()
    @State private var healthMessage: String?

    var body: some View {
        Group {
            if auth.isSignedIn {
                signedInContent
            } else {
                signedOutContent
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
    private var signedOutContent: some View {
        List {
            Section {
                Label("Browse without signing in", systemImage: "map")
                Text("Map and list work for everyone. Sign in is only required to submit TTF observations and rate parent attributes.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Section("Sign in") {
                Button {
                    Task {
                        await auth.signInWithApple()
                        if auth.isSignedIn {
                            await viewModel.refreshProfile(api: api, auth: auth)
                        }
                    }
                } label: {
                    Label("Sign in with Apple", systemImage: "apple.logo")
                }
                .disabled(auth.isLoading)

                if auth.isLoading || viewModel.isRefreshingProfile {
                    ProgressView()
                }

                if let error = auth.errorMessage ?? viewModel.profileError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                } else {
                    Text("Apple Sign-In is not wired up yet — coming in the next iOS milestone.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            apiSection

            Section("Developer testing") {
                Text("To test submit flows before Apple Sign-In works, add a scheme environment variable `TTF_DEV_TOKEN` with a Firebase emulator or dev token.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("Generate one: docker compose run --rm api python scripts/get_emulator_token.py")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
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

            apiSection

            Section {
                Button("Sign out", role: .destructive) {
                    auth.signOut()
                    healthMessage = nil
                }
            }
        }
    }

    @ViewBuilder
    private var apiSection: some View {
        Section("Connection") {
            LabeledContent("API", value: AppConfig.apiBaseURL.host ?? "—")
            LabeledContent("Restaurants loaded", value: store.isEmpty ? "—" : "\(store.mapEntries.count)")
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
    }
}
