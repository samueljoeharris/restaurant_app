import SwiftUI

@MainActor
struct RestaurantDetailView: View {
    @Environment(APIClient.self) private var api
    @Environment(AuthService.self) private var auth
    let restaurantID: UUID

    @State private var viewModel: RestaurantDetailViewModel
    @State private var showSignIn = false

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
                    Task { await viewModel.load(api: api) }
                }
            } else if let detail = viewModel.detail {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        header(for: detail)
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
            await viewModel.load(api: api)
        }
    }

    @ViewBuilder
    private func header(for detail: RestaurantDetailResponse) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(detail.restaurant.address)
                .foregroundStyle(.secondary)
            if !detail.restaurant.cuisineTags.isEmpty {
                Text(detail.restaurant.cuisineTags.joined(separator: " · "))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
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
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Kid food speed: \(TtfTierLogic.formattedMedian(ttf)), \(tier.label)")
            if ttf.sampleSize > 0 {
                Text("\(ttf.sampleSize) visit\(ttf.sampleSize == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("No TTF observations yet — be the first!")
                    .font(.caption)
                    .foregroundStyle(.secondary)
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
                NavigationLink {
                    TtfSubmitView(restaurantID: restaurantID)
                } label: {
                    Label("Submit TTF", systemImage: "plus.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)

                NavigationLink {
                    RateAttributesView(restaurantID: restaurantID)
                } label: {
                    Label("Rate parent attributes", systemImage: "hand.thumbsup")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            } else {
                Button {
                    showSignIn = true
                } label: {
                    Label("Sign in to contribute", systemImage: "person.crop.circle.badge.plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }

            if let urlString = viewModel.detail?.restaurant.googleMapsUrl,
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

    @ViewBuilder
    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Notes")
                .font(.headline)
            if viewModel.notes.isEmpty {
                Text("No notes yet.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(viewModel.notes) { note in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(note.text)
                        if !note.tags.isEmpty {
                            Text(note.tags.joined(separator: ", "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }
}
