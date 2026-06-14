import SwiftUI

struct SignInView: View {
    @Environment(AuthService.self) private var auth
    @Environment(APIClient.self) private var api
    @State private var viewModel = AuthViewModel()

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "fork.knife.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.tint)

            Text("Little Scout")
                .font(.largeTitle.bold())

            Text("Sign in to submit TTF observations and rate restaurants in \(AppConfig.pilotDisplayName).")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)

            Button {
                Task {
                    await auth.signInWithApple()
                    if auth.isSignedIn {
                        await viewModel.refreshProfile(api: api, auth: auth)
                    }
                }
            } label: {
                Label("Sign in with Apple", systemImage: "apple.logo")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(auth.isLoading)

            if auth.isLoading || viewModel.isRefreshingProfile {
                ProgressView()
            }

            if let error = auth.errorMessage ?? viewModel.profileError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            #if DEBUG
            devTokenHint
            #endif
        }
        .padding()
    }

    #if DEBUG
    @ViewBuilder
    private var devTokenHint: some View {
        VStack(spacing: 8) {
            Text("Dev testing")
                .font(.caption.bold())
            Text("Set scheme env `TTF_DEV_TOKEN` to a Firebase emulator or dev token to call write endpoints before Apple Sign-In is wired up.")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 16)
    }
    #endif
}
