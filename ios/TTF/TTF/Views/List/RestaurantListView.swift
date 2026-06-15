import SwiftUI

struct RestaurantListView: View {
    @Environment(APIClient.self) private var api
    @Environment(RestaurantStore.self) private var store
    @State private var searchQuery = ""

    private var displayedRestaurants: [RestaurantSummary] {
        store.filteredSummaries(matching: searchQuery)
    }

    var body: some View {
        Group {
            if store.isLoading && store.isEmpty {
                ProgressView("Loading restaurants…")
            } else if let error = store.errorMessage, store.isEmpty {
                ContentUnavailableView {
                    Label("Could not load list", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await store.refresh(api: api) }
                    }
                }
            } else {
                List(displayedRestaurants) { restaurant in
                    NavigationLink {
                        RestaurantDetailView(restaurantID: restaurant.id)
                    } label: {
                        RestaurantRowView(
                            restaurant: restaurant,
                            ttf: store.entry(for: restaurant.id)?.ttf
                        )
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await store.refresh(api: api)
                }
            }
        }
        .navigationTitle("Restaurants")
        .searchable(text: $searchQuery, prompt: "Search name, address, or cuisine")
        .overlay {
            if !store.isEmpty, displayedRestaurants.isEmpty {
                ContentUnavailableView.search(text: searchQuery)
            }
        }
    }
}

private struct RestaurantRowView: View {
    let restaurant: RestaurantSummary
    let ttf: TtfAggregate?

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if let ttf {
                Circle()
                    .fill(TtfTierLogic.tier(for: ttf).color)
                    .frame(width: 10, height: 10)
                    .padding(.top, 5)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(restaurant.name)
                    .font(.headline)
                Text(restaurant.address)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if let ttf, ttf.sampleSize > 0 {
                    Text("TTF: \(TtfTierLogic.formattedMedian(ttf)) · \(ttf.sampleSize) visits")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
