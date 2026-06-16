import SwiftUI

struct HomeView: View {
    @Environment(RestaurantStore.self) private var store
    @Bindable var placeSearchVM: PlaceSearchViewModel
    @Binding var selectedTab: AppTab

    @State private var searchText = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Little Scout")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    Text("What are you looking for?")
                        .font(.largeTitle.bold())
                    Text("Pick restaurants by starter speed, kid-friendly details, and notes from other caregivers.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Search by restaurant name or place")
                        .font(.subheadline.weight(.medium))
                    PlaceSearchField(viewModel: placeSearchVM, searchText: $searchText)
                }

                VStack(spacing: 12) {
                    homeOption(
                        title: "Browse every restaurant",
                        subtitle: storeSubtitle,
                        systemImage: "list.bullet",
                        tab: .list
                    )
                    homeOption(
                        title: "Open the map",
                        subtitle: "Scan the area and tap a pin",
                        systemImage: "map",
                        tab: .map
                    )
                }
            }
            .padding()
        }
        .navigationTitle("Home")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: Binding(
            get: { placeSearchVM.selectedRestaurantID },
            set: { _ in placeSearchVM.clearSelectedRestaurant() }
        )) { restaurantID in
            RestaurantDetailView(restaurantID: restaurantID)
        }
        .onChange(of: placeSearchVM.areaLabel) { _, label in
            if label != nil {
                selectedTab = .list
            }
        }
        .onChange(of: placeSearchVM.selectedRestaurantID) { _, id in
            if id != nil {
                searchText = ""
            }
        }
    }

    private var storeSubtitle: String {
        if store.isLoading && store.isEmpty {
            return "Loading pilot restaurants…"
        }
        if store.isEmpty {
            return "No restaurants loaded yet"
        }
        return "\(store.mapEntries.count) places in the pilot"
    }

    private func homeOption(
        title: String,
        subtitle: String,
        systemImage: String,
        tab: AppTab
    ) -> some View {
        Button {
            selectedTab = tab
        } label: {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.title3)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(.primary)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding()
            .background(.background, in: RoundedRectangle(cornerRadius: 12))
            .overlay {
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.primary.opacity(0.08))
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title). \(subtitle)")
        .accessibilityHint("Opens the \(title.lowercased()) tab")
    }
}

enum AppTab: Hashable {
    case home
    case map
    case list
    case account
}
