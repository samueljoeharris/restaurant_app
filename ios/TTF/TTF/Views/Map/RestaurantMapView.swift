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
                countChip
                searchAreaBanner
            }
            .padding(.top, 4)
            .animation(.default, value: coverage.phase)
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
    }

    private var mapContent: some View {
        Map(position: $cameraPosition, selection: $selectedRestaurantID) {
            ForEach(visibleEntries) { entry in
                Marker(entry.name, coordinate: entry.coordinate)
                    .tint(TtfTierLogic.tier(for: entry.ttf).color)
                    .tag(entry.id)
            }
            if let userLocation {
                Annotation("You", coordinate: userLocation) {
                    ZStack {
                        Circle()
                            .fill(Color.accentColor.opacity(0.2))
                            .frame(width: 28, height: 28)
                        Circle()
                            .fill(Color.accentColor)
                            .frame(width: 12, height: 12)
                            .overlay {
                                Circle().strokeBorder(.white, lineWidth: 2)
                            }
                    }
                    .accessibilityLabel("Your location")
                }
            }
        }
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
