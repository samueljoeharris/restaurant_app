import SwiftUI

struct RestaurantListView: View {
    @Environment(APIClient.self) private var api
    @Environment(RestaurantStore.self) private var store

    @Bindable var placeSearchVM: PlaceSearchViewModel
    @State private var searchText = ""

    private var isAreaMode: Bool {
        placeSearchVM.areaLabel != nil
    }

    var body: some View {
        Group {
            if store.isLoading && store.isEmpty && !isAreaMode {
                ProgressView("Loading restaurants…")
            } else if let error = store.errorMessage, store.isEmpty, !isAreaMode {
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
                mainContent
            }
        }
        .navigationTitle("Explore")
        .searchable(text: $searchText, prompt: "Search by name, place, or neighborhood")
        .onChange(of: searchText) { _, newValue in
            placeSearchVM.queryChanged(newValue)
        }
        .overlay(alignment: .top) {
            if !placeSearchVM.suggestions.isEmpty {
                PlaceSearchSuggestionsView(suggestions: placeSearchVM.suggestions) { suggestion in
                    placeSearchVM.select(suggestion)
                    searchText = suggestion.primaryText
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .zIndex(1)
            }
        }
        .navigationDestination(item: Binding(
            get: { placeSearchVM.selectedRestaurantID },
            set: { _ in placeSearchVM.clearSelectedRestaurant() }
        )) { restaurantID in
            RestaurantDetailView(restaurantID: restaurantID)
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        if let label = placeSearchVM.areaLabel {
            areaSearchContent(label: label)
        } else {
            defaultListContent
        }
    }

    @ViewBuilder
    private func areaSearchContent(label: String) -> some View {
        let radiusKm = 8
        List {
            Section {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(placeSearchVM.isPendingPlaceMode ? "Places near \(label)" : "Near \(label)")
                            .font(.subheadline.bold())
                        Text(
                            placeSearchVM.isPendingPlaceMode
                                ? "Locating area…"
                                : "Within \(radiusKm) km"
                        )
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Clear") {
                        placeSearchVM.clearAreaSearch()
                        searchText = ""
                    }
                    .font(.subheadline)
                }
                .padding(.vertical, 4)

                if placeSearchVM.seedState == .seeding {
                    HStack(spacing: 8) {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Finding more nearby…")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if placeSearchVM.isPendingPlaceMode {
                Section {
                    HStack {
                        Spacer()
                        ProgressView("Locating area…")
                        Spacer()
                    }
                    .padding(.vertical, 8)
                }
            } else if placeSearchVM.isSearching && placeSearchVM.radiusResults.isEmpty {
                Section {
                    HStack {
                        Spacer()
                        ProgressView("Searching…")
                        Spacer()
                    }
                    .padding(.vertical, 8)
                }
            } else if placeSearchVM.radiusResults.isEmpty {
                Section {
                    ContentUnavailableView(
                        "No restaurants found",
                        systemImage: "fork.knife",
                        description: Text("No restaurants found within \(radiusKm) km of \(label).")
                    )
                }
            } else {
                Section {
                    ForEach(placeSearchVM.radiusResults) { entry in
                        let summary = RestaurantSummary(from: entry)
                        NavigationLink {
                            RestaurantDetailView(restaurantID: entry.id)
                        } label: {
                            RestaurantRowView(restaurant: summary, ttf: entry.ttf)
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
    }

    @ViewBuilder
    private var defaultListContent: some View {
        let filtered: [RestaurantSummary] = {
            let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? store.summaries : store.filteredSummaries(matching: trimmed)
        }()

        List(filtered) { restaurant in
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
        .overlay {
            if !store.isEmpty, filtered.isEmpty {
                ContentUnavailableView.search(text: searchText)
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
