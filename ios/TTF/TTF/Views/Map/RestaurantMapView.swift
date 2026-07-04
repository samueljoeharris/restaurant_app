import MapKit
import SwiftUI

@MainActor
struct RestaurantMapView: View {
    @Environment(APIClient.self) private var api
    @Environment(RestaurantStore.self) private var store
    @Environment(AuthService.self) private var auth

    @State private var coverage = CoverageModel()
    @State private var locationManager = LocationManager()
    @State private var selectedRestaurantID: UUID?
    @State private var userLocation: CLLocationCoordinate2D?
    @State private var locating = false
    @State private var statusMessage: String?
    @State private var visibleRegion: MKCoordinateRegion? = RestaurantMapView.initialRegion
    @State private var cameraPosition = MapCameraPosition.region(RestaurantMapView.initialRegion)
    @State private var searchVM: PlaceSearchViewModel?
    @State private var searchText = ""
    @FocusState private var searchFieldFocused: Bool

    private static let initialRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(
            latitude: AppConfig.pilotCenterLatitude,
            longitude: AppConfig.pilotCenterLongitude
        ),
        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
    )

    private var visibleEntries: [RestaurantMapEntry] {
        guard let region = visibleRegion else { return store.mapEntries }
        return store.mapEntries.filter { region.contains($0.coordinate) }
    }

    private var isSparse: Bool {
        guard let region = visibleRegion else { return false }
        let count = store.mapEntries.reduce(into: 0) { total, entry in
            if region.contains(entry.coordinate) { total += 1 }
        }
        return count <= CoverageGeo.sparseViewportMax
    }

    /// Suggestions drop down only while the field is focused with a non-empty query.
    private var suggestionsVisible: Bool {
        searchFieldFocused
            && !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !(searchVM?.suggestions.isEmpty ?? true)
    }

    var body: some View {
        Group {
            if store.isLoading && store.isEmpty {
                ProgressView("Loading restaurants…")
            } else if let error = store.errorMessage, store.isEmpty {
                ErrorStateView(message: error) {
                    Task { await store.refresh(api: api) }
                }
            } else {
                mapContent
            }
        }
        .navigationTitle("Map")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if store.isRefreshing {
                    ProgressView()
                } else {
                    Button {
                        Task { await store.refresh(api: api) }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityLabel("Refresh restaurants")
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            MapLegendView()
        }
        .navigationDestination(item: $selectedRestaurantID) { restaurantID in
            RestaurantDetailView(restaurantID: restaurantID)
        }
        .overlay(alignment: .top) {
            VStack(spacing: 8) {
                if let searchVM {
                    MapSearchOverlay(
                        viewModel: searchVM,
                        searchText: $searchText,
                        isFocused: $searchFieldFocused,
                        onSelect: { selectSuggestion($0) },
                        onClear: { clearSearch() }
                    )
                }
                if !suggestionsVisible {
                    areaChip
                    countChip
                    searchAreaBanner
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .animation(.default, value: coverage.phase)
            .animation(.easeOut(duration: 0.2), value: suggestionsVisible)
        }
        .overlay(alignment: .bottomTrailing) {
            MapLocateFab(busy: locating, active: userLocation != nil) {
                Task { await locateMe() }
            }
            .padding(.trailing, 16)
            .padding(.bottom, 12)
        }
        .overlay(alignment: .bottom) {
            if let statusMessage {
                Text(statusMessage)
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.bottom, 72)
                    .transition(.opacity)
            }
        }
        .onAppear {
            if searchVM == nil {
                searchVM = PlaceSearchViewModel(api: api)
            }
        }
        .onChange(of: searchVM?.resolvedLat) { _, newLat in
            // Area search resolved — recenter the camera on the searched place.
            guard let newLat, let lng = searchVM?.resolvedLng else { return }
            let region = MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: newLat, longitude: lng),
                span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
            )
            withAnimation(.easeOut(duration: 0.25)) {
                cameraPosition = .region(region)
            }
            visibleRegion = region
        }
        .onChange(of: searchVM?.seedState) { _, newState in
            // Coverage seeding for the searched area finished — pull the new pins in.
            if newState == .done {
                Task { await store.refresh(api: api) }
            }
        }
    }

    private var mapContent: some View {
        Map(position: $cameraPosition, selection: $selectedRestaurantID) {
            ForEach(visibleEntries) { entry in
                Annotation(entry.name, coordinate: entry.coordinate, anchor: .bottom) {
                    TierPinView(
                        entry: entry,
                        selected: selectedRestaurantID == entry.id
                    )
                }
                .tag(entry.id)
            }
            if let userLocation {
                Annotation("You", coordinate: userLocation) {
                    ZStack {
                        Circle()
                            .fill(Color.brand.opacity(0.2))
                            .frame(width: 28, height: 28)
                        Circle()
                            .fill(Color.brand)
                            .frame(width: 12, height: 12)
                            .overlay {
                                Circle().strokeBorder(.white, lineWidth: 2)
                            }
                    }
                    .accessibilityLabel("Your location")
                }
            }
        }
        .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
        .onMapCameraChange(frequency: .onEnd) { context in
            visibleRegion = context.region
        }
        .mapControls {
            MapCompass()
        }
        .onChange(of: userLocation?.latitude) { _, _ in
            guard let coordinate = userLocation else { return }
            let region = MKCoordinateRegion(
                center: coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.04, longitudeDelta: 0.04)
            )
            cameraPosition = .region(region)
            visibleRegion = region
        }
    }

    @ViewBuilder
    private var countChip: some View {
        if !store.isEmpty, let loaded = store.lastLoadedAt {
            Text("\(store.mapEntries.count) places · updated \(loaded.formatted(date: .omitted, time: .shortened))")
                .font(.caption2)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(.ultraThinMaterial, in: Capsule())
                .accessibilityLabel("\(store.mapEntries.count) places, updated \(loaded.formatted(date: .omitted, time: .shortened))")
        }
    }

    /// Small dismissable pill shown while an area search is active ("Near Ballard").
    @ViewBuilder
    private var areaChip: some View {
        if let searchVM, let label = searchVM.areaLabel {
            HStack(spacing: 8) {
                if searchVM.isPendingPlaceMode || searchVM.seedState == .seeding {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: "mappin.circle.fill")
                        .foregroundStyle(Color.brand)
                }
                Text(searchVM.isPendingPlaceMode ? "Locating \(label)…" : "Near \(label)")
                    .font(.caption.bold())
                    .lineLimit(1)
                Button {
                    clearSearch()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                }
                .buttonStyle(.plain)
                .foregroundStyle(Color.textMuted)
                .accessibilityLabel("Clear area search")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial, in: Capsule())
        }
    }

    /// Handle a tapped autocomplete suggestion: restaurants push detail (a parent
    /// wants to rate it), places recenter the map and kick off coverage.
    private func selectSuggestion(_ suggestion: PlaceSuggestion) {
        searchFieldFocused = false
        guard let searchVM else { return }
        searchVM.select(suggestion)

        if suggestion.type == "restaurant",
           let rid = suggestion.restaurantId,
           let uuid = UUID(uuidString: rid) {
            // The map drives navigation itself — keep the VM's selection clear.
            searchVM.clearSelectedRestaurant()
            searchText = ""
            if let lat = suggestion.lat, let lng = suggestion.lng {
                let region = MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: lat, longitude: lng),
                    span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
                )
                cameraPosition = .region(region)
                visibleRegion = region
            }
            selectedRestaurantID = uuid
        } else {
            // Area/place: keep the label in the field; camera recenters once the
            // place resolves (see onChange of resolvedLat).
            searchText = suggestion.primaryText
        }
    }

    /// Reset the whole search state: text, suggestions, and any active area mode.
    private func clearSearch() {
        searchText = ""
        searchVM?.queryChanged("")
        searchVM?.clearAreaSearch()
    }

    @ViewBuilder
    private var searchAreaBanner: some View {
        switch coverage.phase {
        case .idle:
            if isSparse, let region = visibleRegion {
                Button {
                    searchThisArea(region)
                } label: {
                    Label("Search this area", systemImage: "magnifyingglass")
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
            }
        case .seeding:
            statusCapsule(coverage.phase.message ?? "Searching…", busy: true)
        case .covered(let message), .error(let message):
            statusCapsule(message, busy: false, dismissable: true)
        }
    }

    private func statusCapsule(_ message: String, busy: Bool, dismissable: Bool = false) -> some View {
        HStack(spacing: 8) {
            if busy { ProgressView() }
            Text(message)
                .font(.caption)
            if dismissable {
                Button { coverage.dismiss() } label: {
                    Image(systemName: "xmark.circle.fill")
                }
                .buttonStyle(.plain)
                .foregroundStyle(Color.textMuted)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial, in: Capsule())
    }

    private func locateMe() async {
        locating = true
        statusMessage = nil
        defer { locating = false }
        do {
            let coordinate = try await locationManager.requestCoordinate()
            userLocation = coordinate
            if auth.isSignedIn {
                statusMessage = "Finding restaurants near you…"
                BackgroundCoverage.run(
                    api: api,
                    lat: coordinate.latitude,
                    lng: coordinate.longitude,
                    radiusM: BackgroundCoverage.defaultSearchRadiusM
                ) {
                    await store.refresh(api: api)
                    statusMessage = nil
                }
            }
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func searchThisArea(_ region: MKCoordinateRegion) {
        guard auth.isSignedIn else {
            statusMessage = "Sign in to find more restaurants in this area."
            return
        }
        let radius = CoverageGeo.radiusMeters(for: region)
        statusMessage = "Searching this area…"
        BackgroundCoverage.run(
            api: api,
            lat: region.center.latitude,
            lng: region.center.longitude,
            radiusM: radius
        ) {
            await store.refresh(api: api)
            statusMessage = nil
        }
    }
}

/// Floating rounded search field over the map, with the shared autocomplete
/// dropdown beneath it. Mirrors the web explore page's search-over-map.
private struct MapSearchOverlay: View {
    @Bindable var viewModel: PlaceSearchViewModel
    @Binding var searchText: String
    var isFocused: FocusState<Bool>.Binding
    let onSelect: (PlaceSuggestion) -> Void
    let onClear: () -> Void

    private var showsSuggestions: Bool {
        isFocused.wrappedValue
            && !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !viewModel.suggestions.isEmpty
    }

    var body: some View {
        VStack(spacing: 8) {
            searchField
            if showsSuggestions {
                PlaceSearchSuggestionsView(suggestions: viewModel.suggestions) { suggestion in
                    onSelect(suggestion)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.easeOut(duration: 0.2), value: showsSuggestions)
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color.textMuted)
            TextField("Search restaurants or places", text: $searchText)
                .focused(isFocused)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .onSubmit { isFocused.wrappedValue = false }
                .onChange(of: searchText) { _, newValue in
                    // Only user edits (field focused) should refetch — programmatic
                    // resets after a selection shouldn't resurface suggestions.
                    if isFocused.wrappedValue {
                        viewModel.queryChanged(newValue)
                    }
                }
            if viewModel.isSearching {
                ProgressView()
                    .controlSize(.small)
            }
            if !searchText.isEmpty {
                Button {
                    onClear()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.textMuted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.surface, in: RoundedRectangle(cornerRadius: 14))
        .overlay {
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(Color.border)
        }
        .shadow(color: .black.opacity(0.12), radius: 8, x: 0, y: 4)
    }
}

private struct MapLegendView: View {
    var body: some View {
        HStack(spacing: 12) {
            ForEach([TtfTier.fast, .ok, .slow], id: \.self) { tier in
                HStack(spacing: 4) {
                    Circle().fill(tier.color).frame(width: 8, height: 8)
                    Text(tier.label)
                        .font(.caption2)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial, in: Capsule())
        .padding(.bottom, 8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Map legend: green fast, yellow OK, red slow")
    }
}

private extension RestaurantMapEntry {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}
