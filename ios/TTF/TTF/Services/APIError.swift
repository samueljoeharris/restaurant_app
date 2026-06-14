import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case unauthorized
    case httpStatus(Int, String)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            "Invalid API URL."
        case .unauthorized:
            "Sign in required."
        case .httpStatus(let code, let detail):
            "Request failed (\(code)): \(detail)"
        case .decoding(let error):
            "Could not read server response: \(error.localizedDescription)"
        }
    }
}
