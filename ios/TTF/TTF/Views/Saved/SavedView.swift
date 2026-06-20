import SwiftUI

@MainActor
struct SavedView: View {
    @Environment(APIClient.self) private var api
    @Environment(AuthService.self) private var auth

    @State private var items: [WatchedRestaurantEntry] = []
    @State private var unreadCount = 0
    @State private var loading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if loading {
                ProgressView("Loading saved spots…")
            } else if let errorMessage {
                ErrorStateView(message: errorMessage) {
                    Task { await load() }
                }
            } else if items.isEmpty {
                ContentUnavailableView(
                    "No saved spots",
                    systemImage: "heart",
                    description: Text("Watch restaurants from the map or detail screen.")
                )
            } else {
                List {
                    if unreadCount > 0 {
                        Section {
                            Text("\(unreadCount) update\(unreadCount == 1 ? "" : "s") since you last checked")
                                .font(.subheadline.bold())
                        }
                    }
                    Section("Saved") {
                        ForEach(items) { entry in
                            if let id = entry.restaurant.id {
                                NavigationLink {
                                    RestaurantDetailView(restaurantID: id)
                                } label: {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(entry.restaurant.name).font(.headline)
                                        Text(entry.restaurant.address)
                                            .font(.caption)
                                            .foregroundStyle(Color.textMuted)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Saved")
        .task { await load() }
    }

    private func load() async {
        guard auth.isSignedIn else {
            errorMessage = "Sign in to view saved spots."
            loading = false
            return
        }
        loading = true
        errorMessage = nil
        do {
            async let watches = api.listWatches()
            async let unread = api.getUnreadActivityCount()
            items = try await watches.items
            unreadCount = try await unread.unreadCount
        } catch {
            errorMessage = error.localizedDescription
        }
        loading = false
    }
}
