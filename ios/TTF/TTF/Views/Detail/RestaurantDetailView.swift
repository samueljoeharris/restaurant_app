import SwiftUI
import MapKit

@MainActor
struct RestaurantDetailView: View {
    @Environment(APIClient.self) private var api
    @Environment(AuthService.self) private var auth
    let restaurantID: UUID

    @State private var viewModel: RestaurantDetailViewModel
    @State private var showSignIn = false
    @State private var watched = false
    @State private var watchBusy = false

    init(restaurantID: UUID) {
        self.restaurantID = restaurantID
        _viewModel = State(initialValue: RestaurantDetailViewModel(restaurantID: restaurantID))
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.detail == nil {
                ProgressView("Loading…")
            } else if let error = viewModel.errorMessage, viewModel.detail == nil {
                ErrorStateView(message: error) {
                    Task { await viewModel.load(api: api, fetchPractical: auth.isSignedIn) }
                }
            } else if let detail = viewModel.detail {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        header(for: detail)
                        practicalInfoSection(for: detail.restaurant)
                        ttfCard(for: detail.ttf)
                        actionLinks
                        if !viewModel.notes.isEmpty {
                            notesSection
                        }
                    }
                    .padding()
                }
            }
        }
        .navigationTitle(viewModel.detail?.restaurant.name ?? "Restaurant")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.load(api: api, fetchPractical: auth.isSignedIn)
            if let detail = viewModel.detail {
                watched = detail.watched
            }
        }
        .onChange(of: viewModel.detail?.watched) { _, value in
            if let value { watched = value }
        }
        .onChange(of: auth.isSignedIn) { _, signedIn in
            Task { await viewModel.load(api: api, fetchPractical: signedIn) }
        }
    }

    @ViewBuilder
    private func practicalInfoSection(for restaurant: RestaurantDetail) -> some View {
        if let practical = viewModel.practical {
            VStack(alignment: .leading, spacing: 10) {
                Label("Hours & directions", systemImage: "clock")
                    .font(.headline)

                HStack(spacing: 8) {
                    if let openNow = practical.openNow {
                        Text(openNow ? "Open now" : "Closed")
                            .font(.caption.bold())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(openNow ? Color.successSoft : Color.surfaceMuted, in: Capsule())
                            .foregroundStyle(openNow ? Color.success : Color.textMuted)
                    }
                    if let summary = practical.hoursSummary {
                        Text(summary)
                            .font(.subheadline)
                            .foregroundStyle(Color.textMuted)
                    }
                }

                if let rating = practical.googleRating {
                    let countText = practical.googleRatingCount.map { " · \($0) reviews" } ?? ""
                    Text("Google rating \(rating, specifier: "%.1f")\(countText)")
                        .font(.caption)
                        .foregroundStyle(Color.textMuted)
                }

                HStack(spacing: 12) {
                    Button {
                        openDirections(to: restaurant)
                    } label: {
                        Label("Directions", systemImage: "arrow.triangle.turn.up.right.diamond")
                    }
                    .buttonStyle(.bordered)

                    if let phone = practical.phone, let url = URL(string: "tel:\(phone)") {
                        Link(destination: url) {
                            Label("Call", systemImage: "phone")
                        }
                        .buttonStyle(.bordered)
                    }

                    if let website = practical.website, let url = URL(string: website) {
                        Link(destination: url) {
                            Label("Website", systemImage: "globe")
                        }
                        .buttonStyle(.bordered)
                    }
                }

                Text("Powered by Google")
                    .font(.caption2)
                    .foregroundStyle(Color.textMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private func openDirections(to restaurant: RestaurantDetail) {
        let coordinate = CLLocationCoordinate2D(latitude: restaurant.lat, longitude: restaurant.lng)
        let placemark = MKPlacemark(coordinate: coordinate)
        let item = MKMapItem(placemark: placemark)
        item.name = restaurant.name
        item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
    }

    @ViewBuilder
    private func header(for detail: RestaurantDetailResponse) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(detail.restaurant.address)
                .foregroundStyle(Color.textMuted)
            if !detail.restaurant.cuisineTags.isEmpty {
                Text(detail.restaurant.cuisineTags.joined(separator: " · "))
                    .font(.subheadline)
                    .foregroundStyle(Color.textMuted)
            }
        }
    }

    @ViewBuilder
    private func ttfCard(for ttf: TtfAggregate) -> some View {
        let tier = TtfTierLogic.tier(for: ttf)
        VStack(alignment: .leading, spacing: 8) {
            Label("Kid food speed", systemImage: "timer")
                .font(.headline)
            HStack {
                Circle().fill(tier.color).frame(width: 12, height: 12)
                    .accessibilityHidden(true)
                Text(TtfTierLogic.formattedMedian(ttf))
                    .font(.title2.bold())
                Text(tier.label)
                    .foregroundStyle(Color.textMuted)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Kid food speed: \(TtfTierLogic.formattedMedian(ttf)), \(tier.label)")
            if ttf.sampleSize > 0 {
                Text("\(ttf.sampleSize) visit\(ttf.sampleSize == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(Color.textMuted)
            } else {
                Text("No TTF observations yet — be the first!")
                    .font(.caption)
                    .foregroundStyle(Color.textMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private var actionLinks: some View {
        VStack(spacing: 12) {
            if auth.isSignedIn {
                Button {
                    Task { await toggleWatch() }
                } label: {
                    Label(watched ? "Saved" : "Watch", systemImage: watched ? "heart.fill" : "heart")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(watchBusy)

                NavigationLink {
                    TtfSubmitView(restaurantID: restaurantID)
                } label: {
                    Label("Log kid food speed", systemImage: "plus.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .accessibilityHint("Opens the TTF submission form for this restaurant")

                NavigationLink {
                    RateAttributesView(restaurantID: restaurantID)
                } label: {
                    Label("Rate parent attributes", systemImage: "hand.thumbsup")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .accessibilityHint("Rate kid-friendly attributes like high chairs and noise level")
            } else {
                Button {
                    showSignIn = true
                } label: {
                    Label("Sign in to contribute", systemImage: "person.crop.circle.badge.plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .accessibilityHint("Sign in to submit TTF observations and rate attributes")
            }

            if let urlString = googleMapsUrl(for: viewModel.detail?.restaurant),
               let url = URL(string: urlString) {
                Link(destination: url) {
                    Label("Open in Google Maps", systemImage: "map")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
        }
        .sheet(isPresented: $showSignIn) {
            NavigationStack {
                SignInView()
                    .navigationTitle("Sign in")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { showSignIn = false }
                        }
                    }
            }
        }
        .onChange(of: auth.isSignedIn) { _, signedIn in
            if signedIn { showSignIn = false }
        }
    }

    private func googleMapsUrl(for restaurant: RestaurantDetail?) -> String? {
        guard let restaurant else { return nil }
        if let url = restaurant.googleMapsUrl?.trimmingCharacters(in: .whitespacesAndNewlines), !url.isEmpty {
            return url
        }
        if let placeId = restaurant.googlePlaceId {
            let query = restaurant.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? restaurant.name
            let encodedPlaceId = placeId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? placeId
            return "https://www.google.com/maps/search/?api=1&query=\(query)&query_place_id=\(encodedPlaceId)"
        }
        return "https://www.google.com/maps/search/?api=1&query=\(restaurant.lat),\(restaurant.lng)"
    }

    @ViewBuilder
    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Notes")
                .font(.headline)
            if viewModel.notes.isEmpty {
                Text("No notes yet.")
                    .font(.caption)
                    .foregroundStyle(Color.textMuted)
            } else {
                ForEach(viewModel.notes) { note in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(note.text)
                        if !note.tags.isEmpty {
                            Text(note.tags.joined(separator: ", "))
                                .font(.caption)
                                .foregroundStyle(Color.textMuted)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }

    private func toggleWatch() async {
        guard auth.isSignedIn else {
            showSignIn = true
            return
        }
        watchBusy = true
        let next = !watched
        watched = next
        do {
            if next {
                try await api.watchRestaurant(id: restaurantID)
            } else {
                try await api.unwatchRestaurant(id: restaurantID)
            }
        } catch {
            watched = !next
        }
        watchBusy = false
    }
}
