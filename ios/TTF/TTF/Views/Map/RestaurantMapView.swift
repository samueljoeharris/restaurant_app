import MapKit
import SwiftUI

struct RestaurantMapView: View {
    @Environment(APIClient.self) private var api
    @Environment(RestaurantStore.self) private var store
    @State private var selectedRestaurantID: UUID?
    @State private var cameraPosition = MapCameraPosition.region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(
                latitude: AppConfig.pilotCenterLatitude,
                longitude: AppConfig.pilotCenterLongitude
            ),
            span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
        )
    )

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
                Map(position: $cameraPosition, selection: $selectedRestaurantID) {
                    ForEach(store.mapEntries) { entry in
                        Marker(
                            entry.name,
                            coordinate: entry.coordinate
                        )
                        .tint(TtfTierLogic.tier(for: entry.ttf).color)
                        .tag(entry.id)
                    }
                }
                .mapControls {
                    MapUserLocationButton()
                    MapCompass()
                }
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
            if !store.isEmpty, let loaded = store.lastLoadedAt {
                Text("\(store.mapEntries.count) places · updated \(loaded.formatted(date: .omitted, time: .shortened))")
                    .font(.caption2)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.top, 4)
            }
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
    }
}

private extension RestaurantMapEntry {
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}
