import SwiftUI

/// Standard full-screen error state used when a screen has no content to show.
/// Mirrors the existing ContentUnavailableView pattern but centralizes copy
/// and always offers a retry affordance.
struct ErrorStateView: View {
    let message: String
    var retry: (() -> Void)?

    var body: some View {
        ContentUnavailableView {
            Label("Something went wrong", systemImage: "wifi.exclamationmark")
        } description: {
            Text(message)
        } actions: {
            if let retry {
                Button("Try again", action: retry)
                    .buttonStyle(.borderedProminent)
            }
        }
    }
}
