import FirebaseCore
import SwiftUI

@main
struct TTFApp: App {
    @State private var authService: AuthService
    @State private var apiClient: APIClient
    @State private var restaurantStore = RestaurantStore()

    init() {
        FirebaseApp.configure()
        let auth = AuthService()
        auth.configure()
        _authService = State(initialValue: auth)
        _apiClient = State(initialValue: APIClient(authService: auth))
    }

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environment(authService)
                .environment(apiClient)
                .environment(restaurantStore)
        }
    }
}
