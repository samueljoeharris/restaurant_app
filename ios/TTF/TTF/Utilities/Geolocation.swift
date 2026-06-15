import CoreLocation
import Foundation

enum GeolocationError: LocalizedError {
    case unavailable
    case denied
    case timedOut
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "Location isn't available on this device."
        case .denied:
            return "Location permission denied. Enable it in Settings."
        case .timedOut:
            return "Location request timed out. Try again."
        case .failed(let message):
            return message
        }
    }
}

/// One-shot location request for map centering — mirrors web `geolocation.ts`.
@Observable
@MainActor
final class LocationManager: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocationCoordinate2D, Error>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
    }

    func requestCoordinate() async throws -> CLLocationCoordinate2D {
        guard CLLocationManager.locationServicesEnabled() else {
            throw GeolocationError.unavailable
        }

        switch manager.authorizationStatus {
        case .denied, .restricted:
            throw GeolocationError.denied
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        default:
            break
        }

        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            manager.requestLocation()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let coordinate = locations.last?.coordinate else { return }
        Task { @MainActor in
            continuation?.resume(returning: coordinate)
            continuation = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            if let clError = error as? CLError {
                switch clError.code {
                case .denied:
                    continuation?.resume(throwing: GeolocationError.denied)
                case .locationUnknown:
                    continuation?.resume(throwing: GeolocationError.failed("Location unavailable right now."))
                default:
                    continuation?.resume(throwing: GeolocationError.failed(error.localizedDescription))
                }
            } else {
                continuation?.resume(throwing: GeolocationError.failed(error.localizedDescription))
            }
            continuation = nil
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted {
                continuation?.resume(throwing: GeolocationError.denied)
                continuation = nil
            }
        }
    }
}
