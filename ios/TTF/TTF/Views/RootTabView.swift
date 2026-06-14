import SwiftUI

struct RootTabView: View {
    @Environment(AuthService.self) private var auth
    @Environment(APIClient.self) private var api
    @Environment(RestaurantStore.self) private var store

    var body: some View {
        TabView {
            NavigationStack {
                RestaurantMapView()
            }
            .tabItem {
                Label("Map", systemImage: "map")
            }

            NavigationStack {
                RestaurantListView()
            }
            .tabItem {
                Label("List", systemImage: "list.bullet")
            }

            NavigationStack {
                AccountView()
            }
            .tabItem {
                Label("Account", systemImage: "person.crop.circle")
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
