import Foundation

@Observable
final class APIClient {
    private let baseURL: URL
    private let authService: AuthService
    private let session: URLSession
    private let decoder = JSONDecoder.api
    private let encoder = JSONEncoder.api

    init(
        baseURL: URL = AppConfig.apiBaseURL,
        authService: AuthService,
        session: URLSession = APIClient.defaultSession
    ) {
        self.baseURL = baseURL
        self.authService = authService
        self.session = session
    }

    func health() async throws -> HealthResponse {
        try await request(path: "/health")
    }

    func listRestaurants(query: String? = nil) async throws -> [RestaurantSummary] {
        var items: [URLQueryItem] = []
        if let query, !query.isEmpty {
            items.append(URLQueryItem(name: "q", value: query))
        }
        return try await request(path: "/v1/restaurants", queryItems: items)
    }

    func listRestaurantsForMap() async throws -> [RestaurantMapEntry] {
        try await request(path: "/v1/restaurants/map")
    }

    func getRestaurant(id: UUID) async throws -> RestaurantDetailResponse {
        try await request(path: "/v1/restaurants/\(id.uuidString.lowercased())")
    }

    func listMetrics() async throws -> [MetricDefinition] {
        try await request(path: "/v1/metrics")
    }

    // MARK: - Place Search

    /// Autocomplete suggestions for a partial query. Requires sign-in (metered Google spend).
    func placesAutocomplete(
        query: String,
        sessionToken: String,
        near coordinate: (lat: Double, lng: Double)? = nil
    ) async throws -> [PlaceSuggestion] {
        var components = URLComponents()
        components.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "session_token", value: sessionToken),
        ]
        if let coord = coordinate {
            components.queryItems?.append(URLQueryItem(name: "lat", value: "\(coord.lat)"))
            components.queryItems?.append(URLQueryItem(name: "lng", value: "\(coord.lng)"))
        }
        let queryString = components.percentEncodedQuery.map { "?\($0)" } ?? ""
        let response: AutocompleteResponse = try await request(
            path: "/v1/places/autocomplete\(queryString)",
            authenticated: true
        )
        return response.suggestions
    }

    /// Resolve a Google place_id to coordinates + label. Requires sign-in.
    func resolvePlace(placeId: String, sessionToken: String) async throws -> PlaceResolveResponse {
        let encodedId = placeId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? placeId
        let encodedToken = sessionToken.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? sessionToken
        return try await request(
            path: "/v1/places/resolve?place_id=\(encodedId)&session_token=\(encodedToken)",
            authenticated: true
        )
    }

    /// Live Google practical info for detail surfaces. Requires sign-in.
    func getPlacePractical(placeId: String) async throws -> PlacePracticalResponse {
        if let cached = PlacePracticalCache.get(placeId) {
            return cached
        }
        let encodedId = placeId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? placeId
        let response: PlacePracticalResponse = try await request(
            path: "/v1/places/\(encodedId)/practical",
            authenticated: true
        )
        PlacePracticalCache.set(placeId, data: response)
        return response
    }

    /// Radius-based restaurant search around a point. Public — no auth required.
    func searchRestaurants(
        lat: Double,
        lng: Double,
        radiusM: Int = 8000,
        q: String? = nil
    ) async throws -> [RestaurantMapEntry] {
        var path = "/v1/restaurants/search?lat=\(lat)&lng=\(lng)&radius_m=\(radiusM)"
        if let q, !q.isEmpty {
            let encoded = q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? q
            path += "&q=\(encoded)"
        }
        return try await request(path: path)
    }

    // MARK: - Coverage

    /// Ask the backend to make sure the given area is seeded. Auth-gated and
    /// rate-limited server-side (density check, daily cap, 24h area cooldown).
    func ensureCoverage(lat: Double, lng: Double, radiusM: Int = 8000) async throws -> CoverageEnsureResponse {
        try await request(
            path: "/v1/coverage/ensure",
            method: "POST",
            body: CoverageEnsureRequest(lat: lat, lng: lng, radiusM: radiusM),
            authenticated: true
        )
    }

    /// Poll the status of a coverage seed job created by `ensureCoverage`.
    func getCoverageJob(id: UUID) async throws -> CoverageJobStatus {
        try await request(
            path: "/v1/coverage/jobs/\(id.uuidString.lowercased())",
            authenticated: true
        )
    }

    func getAttributes(restaurantID: UUID) async throws -> [AttributeEntry] {
        let response: AttributesResponse = try await request(
            path: "/v1/restaurants/\(restaurantID.uuidString.lowercased())/attributes"
        )
        return response.attributes.values.sorted { $0.label < $1.label }
    }

    func submitTTF(restaurantID: UUID, submission: TtfSubmission) async throws -> TtfSubmissionResponse {
        try await request(
            path: "/v1/restaurants/\(restaurantID.uuidString.lowercased())/ttf",
            method: "POST",
            body: submission,
            authenticated: true
        )
    }

    func submitAttribute(
        restaurantID: UUID,
        metricKey: String,
        value: AttributeSubmissionValue,
        visitContext: String? = nil
    ) async throws {
        let body = AttributeSubmission(metricKey: metricKey, value: value, visitContext: visitContext)
        let _: AttributeSubmissionResponse = try await request(
            path: "/v1/restaurants/\(restaurantID.uuidString.lowercased())/attributes",
            method: "POST",
            body: body,
            authenticated: true
        )
    }

    func submitNote(restaurantID: UUID, text: String, tags: [String] = []) async throws {
        let body = NoteSubmission(text: text, tags: tags)
        let _: RestaurantNote = try await request(
            path: "/v1/restaurants/\(restaurantID.uuidString.lowercased())/notes",
            method: "POST",
            body: body,
            authenticated: true
        )
    }

    func listNotes(restaurantID: UUID) async throws -> [RestaurantNote] {
        let response: NotesResponse = try await request(
            path: "/v1/restaurants/\(restaurantID.uuidString.lowercased())/notes"
        )
        return response.notes
    }

    func getMe() async throws -> UserProfile {
        try await request(path: "/v1/me", authenticated: true)
    }

    func listWatches() async throws -> WatchedRestaurantsResponse {
        try await request(path: "/v1/me/watches", authenticated: true)
    }

    func watchRestaurant(id: UUID) async throws {
        let _: EmptyResponse = try await request(
            path: "/v1/me/watches/\(id.uuidString.lowercased())",
            method: "POST",
            authenticated: true
        )
    }

    func unwatchRestaurant(id: UUID) async throws {
        try await request(
            path: "/v1/me/watches/\(id.uuidString.lowercased())",
            method: "DELETE",
            authenticated: true
        )
    }

    func getUnreadActivityCount() async throws -> UnreadCountResponse {
        try await request(path: "/v1/me/activity/unread-count", authenticated: true)
    }

    func getActivityInbox(limit: Int = 30) async throws -> ActivityInboxResponse {
        try await request(path: "/v1/me/activity?limit=\(limit)", authenticated: true)
    }

    func deleteAccount(appleAuthorizationCode: String? = nil) async throws {
        let _: EmptyResponse = try await request(
            path: "/v1/me/delete-account",
            method: "POST",
            body: DeleteAccountRequest(
                confirm: true,
                appleAuthorizationCode: appleAuthorizationCode
            ),
            authenticated: true,
            forceRefreshToken: true
        )
    }

    static let defaultSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        config.waitsForConnectivity = true
        // Honor the server's ETag / Cache-Control (304 Not Modified) so repeat
        // map/list reads come from cache instead of refetching the full payload.
        config.requestCachePolicy = .useProtocolCachePolicy
        config.urlCache = URLCache(
            memoryCapacity: 8 * 1024 * 1024,
            diskCapacity: 64 * 1024 * 1024
        )
        return URLSession(configuration: config)
    }()

    // MARK: - Private

    private struct ErrorBody: Decodable {
        let detail: String?
    }

    private struct AttributeSubmissionResponse: Decodable {
        let id: UUID
        let metricKey: String

        enum CodingKeys: String, CodingKey {
            case id
            case metricKey = "metric_key"
        }
    }

    private struct DeleteAccountRequest: Encodable {
        let confirm: Bool
        let appleAuthorizationCode: String?

        enum CodingKeys: String, CodingKey {
            case confirm
            case appleAuthorizationCode = "apple_authorization_code"
        }
    }

    private func request<T: Decodable>(
        path: String,
        method: String = "GET",
        queryItems: [URLQueryItem] = [],
        body: (any Encodable)? = nil,
        authenticated: Bool = false,
        forceRefreshToken: Bool = false
    ) async throws -> T {
        guard let resolved = URL(string: path, relativeTo: baseURL),
              var components = URLComponents(url: resolved, resolvingAgainstBaseURL: true) else {
            throw APIError.invalidURL
        }
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if authenticated {
            let token = try await authService.freshIDToken(forceRefresh: forceRefreshToken)
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let appCheckToken = await authService.appCheckToken() {
            request.setValue(appCheckToken, forHTTPHeaderField: "X-Firebase-AppCheck")
        }

        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.httpStatus(-1, "No HTTP response")
        }

        guard (200 ... 299).contains(http.statusCode) else {
            let detail = (try? decoder.decode(ErrorBody.self, from: data).detail)
                ?? String(data: data, encoding: .utf8)
                ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            throw APIError.httpStatus(http.statusCode, detail)
        }

        if T.self == EmptyResponse.self {
            return EmptyResponse() as! T
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}

private struct EmptyResponse: Decodable {
    init() {}
}
