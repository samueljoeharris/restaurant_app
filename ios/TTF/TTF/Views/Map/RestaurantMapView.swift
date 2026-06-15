import MapKit
import SwiftUI

struct RestaurantMapView: View {
    @Environment(APIClient.self) private var api
    @Environment(RestaurantStore.self) private var store
    @Environment(AuthService.self) private var auth
    @State private var coverage = CoverageModel()
    @State private var selectedRestaurantID: UUID?
    @State private var visibleRegion: MKCoordinateRegion? = RestaurantMapView.initialRegion
    @State private var cameraPosition = MapCameraPosition.region(RestaurantMapView.initialRegion)

    private static let initialRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(
            latitude: AppConfig.pilotCenterLatitude,
            longitude: AppConfig.pilotCenterLongitude
        ),
        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
    )

    /// Only the pins inside the current viewport — keeps the annotation set the map
    /// has to lay out small (the on-main-thread rebuild is SwiftUI `Map`'s bottleneck).
    private var visibleEntries: [RestaurantMapEntry] {
        guard let region = visibleRegion else { return store.mapEntries }
        return store.mapEntries.filter { region.contains($0.coordinate) }
    }

    /// Few enough venues in view that it's worth offering to seed this area.
    private var isSparse: Bool {
        guard let region = visibleRegion else { return false }
        let count = store.mapEntries.reduce(into: 0) { total, entry in
            if region.contains(entry.coordinate) { total += 1 }
        }
        return count <= CoverageGeo.sparseViewportMax
    }

    private var showCoverageCircle: Bool {
        guard isSparse else { return false }
        switch coverage.phase {
        case .idle, .seeding: return true
        case .covered, .error: return false
        }
    }

    var body: some View {
        Group {
            if store.isLoading && store.isEmpty {
                ProgressView("Loading restaurants…")
            } else if let error = store.errorMessage, store.isEmpty {
                ContentUnavailableView {
                    Label("Could not load map", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await store.refresh(api: api) }
                    }
                }
            } else {
                mapContent
            }
        }
        .navigationTitle("Little Scout")
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
                countChip
                coverageBanner
            }
            .padding(.top, 4)
            .animation(.default, value: coverage.phase)
        }
    }

    private var mapContent: some View {
        Map(position: $cameraPosition, selection: $selectedRestaurantID) {
            ForEach(visibleEntries) { entry in
                Marker(entry.name, coordinate: entry.coordinate)
                    .tint(TtfTierLogic.tier(for: entry.ttf).color)
                    .tag(entry.id)
            }
            if showCoverageCircle, let region = visibleRegion {
                MapCircle(
                    center: region.center,
                    radius: CLLocationDistance(CoverageGeo.radiusMeters(for: region))
                )
                .foregroundStyle(.blue.opacity(0.07))
                .stroke(.blue.opacity(0.85), lineWidth: 2)
            }
        }
        .onMapCameraChange(frequency: .onEnded) { context in
            // `.onEnded` fires only when the gesture settles — this is the debounce.
            visibleRegion = context.region
        }
        .mapControls {
            MapUserLocationButton()
            MapCompass()
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
                .accessibilityLabel("\(store.mapEntries.count) places loaded")
        }
    }

    @ViewBuilder
    private var coverageBanner: some View {
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
                .accessibilityHint("Looks for restaurants in the area you're viewing")
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
                .multilineTextAlignment(.center)
            if dismissable {
                Button {
                    coverage.dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .accessibilityLabel("Dismiss")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial, in: Capsule())
        .accessibilityElement(children: .combine)
    }

    private func searchThisArea(_ region: MKCoordinateRegion) {
        guard auth.isSignedIn else {
            coverage.signInRequired()
            return
        }
        coverage.searchThisArea(region: region, api: api, store: store)
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
        .accessibilityLabel("Legend: green is fast, yellow is OK, red is slow time-to-food")
    }
}

private extension RestaurantMapEntry {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}
