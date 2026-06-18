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

extension APIError {
    /// User-facing copy that softens raw HTTP errors for empty/error states.
    var userFacingMessage: String {
        switch self {
        case .unauthorized:
            return "Please sign in to continue."
        case .httpStatus(let code, _) where code == 401:
            return "Please sign in to continue."
        case .httpStatus(let code, _) where code == 403:
            return "Confirm your identity before deleting your account."
        case .httpStatus(let code, _) where code == 429:
            return "You're going a bit fast — please wait a moment and try again."
        case .httpStatus(let code, _) where code >= 500:
            return "Our servers are having a moment. Please try again shortly."
        default:
            return errorDescription ?? "Something went wrong."
        }
    }
}
