import SwiftUI

struct SignInView: View {
    @Environment(AuthService.self) private var auth
    @Environment(APIClient.self) private var api
    @State private var viewModel = AuthViewModel()

    @State private var email = ""
    @State private var password = ""
    @State private var isCreatingAccount = false

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "fork.knife.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.tint)

            Text("Little Scout")
                .font(.largeTitle.bold())

            Text(isCreatingAccount
                 ? "Create an account to submit TTF observations and rate restaurants."
                 : "Sign in to submit TTF observations and rate restaurants in \(AppConfig.pilotDisplayName).")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)

            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .textFieldStyle(.roundedBorder)

                SecureField("Password", text: $password)
                    .textContentType(isCreatingAccount ? .newPassword : .password)
                    .textFieldStyle(.roundedBorder)
            }

            if let error = auth.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            Button {
                Task {
                    if isCreatingAccount {
                        await auth.signUp(email: email, password: password)
                    } else {
                        await auth.signIn(email: email, password: password)
                    }
                    if auth.isSignedIn {
                        await viewModel.refreshProfile(api: api, auth: auth)
                    }
                }
            } label: {
                Text(isCreatingAccount ? "Create account" : "Sign in")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(auth.isLoading || email.isEmpty || password.isEmpty)

            if auth.isLoading || viewModel.isRefreshingProfile {
                ProgressView()
            }

            Button {
                isCreatingAccount.toggle()
            } label: {
                Text(isCreatingAccount ? "Already have an account? Sign in" : "No account? Create one")
                    .font(.footnote)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.tint)

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
            Text("Set scheme env TTF_DEV_TOKEN to a Firebase emulator or dev token to call write endpoints without Firebase setup.")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 16)
    }
    #endif
}
