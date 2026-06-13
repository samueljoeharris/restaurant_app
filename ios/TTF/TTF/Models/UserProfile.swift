import Foundation

struct UserProfile: Codable, Hashable {
    let firebaseUid: String
    let displayName: String?
    let email: String?
    let contributionCount: Int
    let role: String?

    enum CodingKeys: String, CodingKey {
        case email, role
        case firebaseUid = "firebase_uid"
        case displayName = "display_name"
        case contributionCount = "contribution_count"
    }
}
