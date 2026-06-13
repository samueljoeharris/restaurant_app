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
        session: URLSession = .shared
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
