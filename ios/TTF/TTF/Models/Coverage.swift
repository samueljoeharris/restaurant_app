import Foundation

/// Response from `POST /v1/coverage/ensure`.
struct CoverageEnsureResponse: Codable {
    /// `"covered"` or `"queued"`
    let status: String
    let restaurantCount: Int?
    let radiusM: Int?
    let jobId: String?
    let reused: Bool?

    enum CodingKeys: String, CodingKey {
        case status
        case restaurantCount = "restaurant_count"
        case radiusM = "radius_m"
        case jobId = "job_id"
        case reused
    }
}

/// Response from `GET /v1/coverage/jobs/{job_id}`.
struct CoverageJobStatus: Codable {
    let jobId: String
    let status: String
    let insertedCount: Int?
    let updatedCount: Int?

    enum CodingKeys: String, CodingKey {
        case jobId = "job_id"
        case status
        case insertedCount = "inserted_count"
        case updatedCount = "updated_count"
    }
}
