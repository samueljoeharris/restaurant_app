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
        var path = "/v1/restaurants"
        if let query, !query.isEmpty {
            let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
            path += "?q=\(encoded)"
        }
        return try await request(path: path)
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

    /// Trigger a coverage seed job for the given location. Requires sign-in.
    func ensureCoverage(lat: Double, lng: Double, radiusM: Int = 8000) async throws -> CoverageEnsureResponse {
        struct Body: Encodable {
            let lat: Double
            let lng: Double
            let radiusM: Int
            enum CodingKeys: String, CodingKey {
                case lat, lng
                case radiusM = "radius_m"
            }
        }
        return try await request(
            path: "/v1/coverage/ensure",
            method: "POST",
            body: Body(lat: lat, lng: lng, radiusM: radiusM),
            authenticated: true
        )
    }

    /// Poll a coverage seed job by ID. Requires sign-in.
    func coverageJob(id: String) async throws -> CoverageJobStatus {
        let encoded = id.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? id
        return try await request(
            path: "/v1/coverage/jobs/\(encoded)",
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

    func listNotes(restaurantID: UUID) async throws -> [RestaurantNote] {
        let response: NotesResponse = try await request(
            path: "/v1/restaurants/\(restaurantID.uuidString.lowercased())/notes"
        )
        return response.notes
    }

    func getMe() async throws -> UserProfile {
        try await request(path: "/v1/me", authenticated: true)
    }

    static let defaultSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        config.waitsForConnectivity = true
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
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

    private func request<T: Decodable>(
        path: String,
        method: String = "GET",
        body: (any Encodable)? = nil,
        authenticated: Bool = false
    ) async throws -> T {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if authenticated {
            guard let token = authService.idToken else {
                throw APIError.unauthorized
            }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
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
