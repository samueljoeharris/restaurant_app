import MapKit
import SwiftUI

struct RestaurantMapView: View {
    @Environment(APIClient.self) private var api
    @State private var viewModel = MapViewModel()
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
            if viewModel.isLoading && viewModel.entries.isEmpty {
                ProgressView("Loading map…")
            } else if let error = viewModel.errorMessage, viewModel.entries.isEmpty {
                ContentUnavailableView {
                    Label("Could not load map", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await viewModel.load(api: api) }
                    }
                }
            } else {
                Map(position: $cameraPosition) {
                    ForEach(viewModel.entries) { entry in
                        Annotation(entry.name, coordinate: entry.coordinate) {
                            NavigationLink {
                                RestaurantDetailView(restaurantID: entry.id)
                            } label: {
                                MapPinView(entry: entry)
                            }
                            .buttonStyle(.plain)
                        }
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
                Button {
                    Task { await viewModel.load(api: api) }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(viewModel.isLoading)
            }
        }
        .safeAreaInset(edge: .bottom) {
            MapLegendView()
        }
        .task {
            await viewModel.load(api: api)
        }
    }
}

private struct MapPinView: View {
    let entry: RestaurantMapEntry

    var body: some View {
        let tier = TtfTierLogic.tier(for: entry.ttf)
        VStack(spacing: 2) {
            Circle()
                .fill(tier.color)
                .frame(width: 14, height: 14)
                .overlay(Circle().stroke(.white, lineWidth: 2))
            Text(entry.name)
                .font(.caption2)
                .lineLimit(1)
                .padding(.horizontal, 4)
                .background(.ultraThinMaterial, in: Capsule())
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
