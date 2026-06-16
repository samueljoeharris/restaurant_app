import CryptoKit
import Foundation

enum AppleSignInNonce {
  /// Random nonce for Sign in with Apple → Firebase OAuth flow.
  static func random(length: Int = 32) -> String {
    precondition(length > 0)
    let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
    var result = ""
    result.reserveCapacity(length)
    var remaining = length
    while remaining > 0 {
      let randoms: [UInt8] = (0 ..< 16).map { _ in UInt8.random(in: 0 ... 255) }
      randoms.forEach { random in
        if remaining == 0 { return }
        if random < charset.count {
          result.append(charset[Int(random)])
          remaining -= 1
        }
      }
    }
    return result
  }

  static func sha256(_ input: String) -> String {
    let inputData = Data(input.utf8)
    let hashed = SHA256.hash(data: inputData)
    return hashed.compactMap { String(format: "%02x", $0) }.joined()
  }
}
