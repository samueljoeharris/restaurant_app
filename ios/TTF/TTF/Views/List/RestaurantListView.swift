import SwiftUI

struct RestaurantListView: View {
    @Environment(APIClient.self) private var api
    @Environment(RestaurantStore.self) private var store

    @State private var searchText = ""
    @State private var placeSearchVM: PlaceSearchViewModel?

    private var isAreaMode: Bool {
        placeSearchVM?.areaLabel != nil
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
        .navigationTitle("Restaurants")
        .searchable(text: $searchText, prompt: "Search places or restaurants")
        .onChange(of: searchText) { _, newValue in
            placeSearchVM?.queryChanged(newValue)
        }
        .onAppear {
            if placeSearchVM == nil {
                placeSearchVM = PlaceSearchViewModel(api: api)
            }
        }
        .overlay(alignment: .top) {
            if let vm = placeSearchVM, !vm.suggestions.isEmpty {
                PlaceSearchSuggestionsView(suggestions: vm.suggestions) { suggestion in
                    vm.select(suggestion)
                    searchText = ""
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .zIndex(1)
            }
        }
        // Programmatic navigation when a restaurant suggestion is picked.
        .navigationDestination(item: Binding(
            get: { placeSearchVM?.selectedRestaurantID },
            set: { _ in placeSearchVM?.clearSelectedRestaurant() }
        )) { restaurantID in
            RestaurantDetailView(restaurantID: restaurantID)
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        if let vm = placeSearchVM, let label = vm.areaLabel {
            areaSearchContent(vm: vm, label: label)
        } else {
            defaultListContent
        }
    }

    // MARK: - Area mode (place selected)

    @ViewBuilder
    private func areaSearchContent(vm: PlaceSearchViewModel, label: String) -> some View {
        let radiusKm = 8
        List {
            // Context banner
            Section {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Near \(label)")
                            .font(.subheadline.bold())
                        Text("Within \(radiusKm) km")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Clear") {
                        vm.clearAreaSearch()
                        searchText = ""
                    }
                    .font(.subheadline)
                    .foregroundStyle(.accentColor)
                }
                .padding(.vertical, 4)

                if vm.seedState == .seeding {
                    HStack(spacing: 8) {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Finding more nearby…")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            // Radius results
            if vm.isSearching && vm.radiusResults.isEmpty {
                Section {
                    HStack {
                        Spacer()
                        ProgressView("Searching…")
                        Spacer()
                    }
                    .padding(.vertical, 8)
                }
            } else if vm.radiusResults.isEmpty {
                Section {
                    ContentUnavailableView(
                        "No restaurants found",
                        systemImage: "fork.knife",
                        description: Text("No restaurants found within \(radiusKm) km of \(label).")
                    )
                }
            } else {
                Section {
                    ForEach(vm.radiusResults) { entry in
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

    // MARK: - Default mode (store-backed list)

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

// MARK: - Restaurant row

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
