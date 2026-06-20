import SwiftUI

struct RootTabView: View {
    @Environment(AuthService.self) private var auth
    @Environment(APIClient.self) private var api
    @Environment(RestaurantStore.self) private var store

    @State private var selectedTab: AppTab = .home
    @State private var placeSearchVM: PlaceSearchViewModel?

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                if let placeSearchVM {
                    HomeView(placeSearchVM: placeSearchVM, selectedTab: $selectedTab)
                } else {
                    ProgressView()
                }
            }
            .tabItem { Label("Home", systemImage: "house") }
            .tag(AppTab.home)

            NavigationStack {
                RestaurantMapView()
            }
            .tabItem { Label("Map", systemImage: "map") }
            .tag(AppTab.map)

            NavigationStack {
                if let placeSearchVM {
                    RestaurantListView(placeSearchVM: placeSearchVM)
                } else {
                    ProgressView()
                }
            }
            .tabItem { Label("Explore", systemImage: "magnifyingglass") }
            .tag(AppTab.list)

            NavigationStack {
                AccountView()
            }
            .tabItem { Label("Account", systemImage: "person.crop.circle") }
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
