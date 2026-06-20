import SwiftUI

struct RootTabView: View {
    @Environment(AuthService.self) private var auth
    @Environment(APIClient.self) private var api
    @Environment(RestaurantStore.self) private var store

    @State private var selectedTab: AppTab = .map
    @State private var placeSearchVM: PlaceSearchViewModel?

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                RestaurantMapView()
            }
            .tabItem { Label("Explore", systemImage: "map") }
            .tag(AppTab.map)

            NavigationStack {
                SavedView()
            }
            .tabItem { Label("Saved", systemImage: "heart") }
            .tag(AppTab.saved)

            NavigationStack {
                if let placeSearchVM {
                    RestaurantListView(placeSearchVM: placeSearchVM)
                } else {
                    ProgressView()
                }
            }
            .tabItem { Label("Browse", systemImage: "magnifyingglass") }
            .tag(AppTab.list)

            NavigationStack {
                AccountView()
            }
            .tabItem { Label("You", systemImage: "person.crop.circle") }
            .tag(AppTab.account)
        }
        .tint(.brand)
        .onAppear {
            if placeSearchVM == nil {
                placeSearchVM = PlaceSearchViewModel(api: api)
            }
        }
        .task {
            auth.bootstrapDevTokenIfNeeded()
            await store.load(api: api)
            if auth.isSignedIn, auth.profile == nil {
                let viewModel = AuthViewModel()
                await viewModel.refreshProfile(api: api, auth: auth)
            }
        }
    }
}

enum AppTab: Hashable {
    case map
    case saved
    case list
    case account
}
