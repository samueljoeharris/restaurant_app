import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @Environment(AuthService.self) private var auth
    @Environment(APIClient.self) private var api
    @State private var viewModel = AuthViewModel()

    @State private var email = ""
    @State private var password = ""
    @State private var isCreatingAccount = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Image(systemName: "fork.knife.circle.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(.tint)
                    .accessibilityHidden(true)

                Text("Little Scout")
                    .font(.largeTitle.bold())
                    .accessibilityAddTraits(.isHeader)

                Text(isCreatingAccount
                     ? "Create an account to submit TTF observations and rate restaurants."
                     : "Sign in to submit TTF observations and rate restaurants in \(AppConfig.pilotDisplayName).")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.textMuted)

                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.fullName, .email]
                } onCompletion: { _ in
                    // Auth runs through AuthService + AppleSignInCoordinator so we
                    // control the nonce and Firebase credential exchange.
                }
                .frame(height: 48)
                .signInWithAppleButtonStyle(.black)
                .accessibilityLabel("Sign in with Apple")
                .overlay {
                    Button {
                        Task {
                            await auth.signInWithApple()
                            if auth.isSignedIn {
                                await viewModel.refreshProfile(api: api, auth: auth)
                            }
                        }
                    } label: {
                        Color.clear.contentShape(Rectangle())
                    }
                    .accessibilityHidden(true)
                }
                .disabled(auth.isLoading)

                dividerLabel("or use email")

                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityLabel("Email")

                    SecureField("Password", text: $password)
                        .textContentType(isCreatingAccount ? .newPassword : .password)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityLabel("Password")
                }

                if let error = auth.errorMessage ?? viewModel.profileError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(Color.error)
                        .multilineTextAlignment(.center)
                        .accessibilityLabel("Error: \(error)")
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
                    Text(isCreatingAccount ? "Create account" : "Sign in with email")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(auth.isLoading || email.isEmpty || password.isEmpty)
                .accessibilityHint(isCreatingAccount ? "Creates a new account with email and password" : "Signs in with email and password")

                if auth.isLoading || viewModel.isRefreshingProfile {
                    ProgressView()
                        .accessibilityLabel("Signing in")
                }

                Button {
                    isCreatingAccount.toggle()
                    auth.errorMessage = nil
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
    }

    private func dividerLabel(_ text: String) -> some View {
        HStack {
            Rectangle().fill(Color.border.opacity(0.5)).frame(height: 1)
            Text(text)
                .font(.caption)
                .foregroundStyle(Color.textMuted)
            Rectangle().fill(Color.border.opacity(0.5)).frame(height: 1)
        }
        .accessibilityHidden(true)
    }

    #if DEBUG
    @ViewBuilder
    private var devTokenHint: some View {
        VStack(spacing: 8) {
            Text("Dev testing")
                .font(.caption.bold())
            Text("Set scheme env TTF_DEV_TOKEN to a Firebase emulator or dev token to call write endpoints without Firebase setup.")
                .font(.caption2)
                .foregroundStyle(Color.textMuted)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 16)
    }
    #endif
}
