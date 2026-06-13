import SwiftUI

struct RestaurantListView: View {
    @Environment(APIClient.self) private var api
    @State private var viewModel = RestaurantListViewModel()

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.restaurants.isEmpty {
                ProgressView("Loading restaurants…")
            } else if let error = viewModel.errorMessage, viewModel.restaurants.isEmpty {
                ContentUnavailableView {
                    Label("Could not load list", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await viewModel.load(api: api) }
                    }
                }
            } else {
                List(viewModel.restaurants) { restaurant in
                    NavigationLink {
                        RestaurantDetailView(restaurantID: restaurant.id)
                    } label: {
                        RestaurantRowView(restaurant: restaurant)
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await viewModel.load(api: api)
                }
            }
        }
        .navigationTitle("Restaurants")
        .searchable(text: $viewModel.searchQuery, prompt: "Search by name")
        .onSubmit(of: .search) {
            Task { await viewModel.load(api: api) }
        }
        .onChange(of: viewModel.searchQuery) { _, newValue in
            if newValue.isEmpty {
                Task { await viewModel.load(api: api) }
            }
        }
        .task {
            await viewModel.load(api: api)
        }
    }
}

private struct RestaurantRowView: View {
    let restaurant: RestaurantSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(restaurant.name)
                .font(.headline)
            Text(restaurant.address)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if !restaurant.cuisineTags.isEmpty {
                Text(restaurant.cuisineTags.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}
