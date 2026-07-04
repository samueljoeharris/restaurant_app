import Foundation
import Observation

/// The three moments of the TTF flow: waiting to order, timing, and quick capture.
enum TtfSubmitPhase {
    case idle
    case running
    case capture
}

@Observable
final class TtfSubmitViewModel {
    private static let timerStartKey = "ttfTimer.startedAt"
    private static let timerRestaurantKey = "ttfTimer.restaurantID"

    let restaurantID: UUID

    private(set) var restaurantName = ""
    private(set) var isLoadingRestaurant = false
    private(set) var isSubmitting = false
    private(set) var errorMessage: String?
    private(set) var didSubmit = false

    private(set) var phase: TtfSubmitPhase = .idle
    /// True when the user skipped the timer and is entering minutes by hand.
    private(set) var isManualEntry = false

    /// Bumped to fire `.sensoryFeedback(.success, ...)` in the view.
    private(set) var successHapticTick = 0
    /// Bumped to fire `.sensoryFeedback(.error, ...)` in the view.
    private(set) var errorHapticTick = 0

    var elapsedMinutes = 12
    var itemType: TtfItemType = .fries
    var itemQuality = 4
    var portionSize: TtfPortionSize = .kid
    var daypart: TtfDaypart = .current()
    var partySizeKids = 1
    var waitContext = ""

    private var timerStart: Date?
    private(set) var timerStoppedAt: Date?
    private(set) var timerTick = Date()

    init(restaurantID: UUID) {
        self.restaurantID = restaurantID
    }

    var isTimerRunning: Bool {
        timerStart != nil && timerStoppedAt == nil
    }

    var displayedElapsedMinutes: Int {
        if isTimerRunning, let timerStart {
            let seconds = timerTick.timeIntervalSince(timerStart)
            return max(1, Int(seconds / 60))
        }
        if let timerStart, let timerStoppedAt {
            let seconds = timerStoppedAt.timeIntervalSince(timerStart)
            return max(1, Int(seconds / 60))
        }
        return elapsedMinutes
    }

    var timerLabel: String {
        let totalSeconds: Int
        if isTimerRunning, let timerStart {
            totalSeconds = max(0, Int(timerTick.timeIntervalSince(timerStart)))
        } else if let timerStart, let timerStoppedAt {
            totalSeconds = max(0, Int(timerStoppedAt.timeIntervalSince(timerStart)))
        } else {
            totalSeconds = elapsedMinutes * 60
        }
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    @MainActor
    func loadRestaurant(api: APIClient) async {
        isLoadingRestaurant = true
        defer { isLoadingRestaurant = false }
        do {
            let response = try await api.getRestaurant(id: restaurantID)
            restaurantName = response.restaurant.name
        } catch {
            errorMessage = (error as? APIError)?.userFacingMessage ?? error.localizedDescription
        }
    }

    // MARK: - Timer lifecycle

    func startTimer() {
        timerStart = Date()
        timerStoppedAt = nil
        timerTick = Date()
        isManualEntry = false
        phase = .running
        persistTimerStart()
        successHapticTick += 1
    }

    /// "Food's here!" — stop the clock and move to quick capture.
    func foodArrived() {
        guard isTimerRunning else { return }
        timerStoppedAt = Date()
        timerTick = timerStoppedAt ?? Date()
        elapsedMinutes = displayedElapsedMinutes
        phase = .capture
        successHapticTick += 1
    }

    /// Quiet escape hatch from the running timer back to the start.
    func cancelTimer() {
        timerStart = nil
        timerStoppedAt = nil
        timerTick = Date()
        phase = .idle
        clearPersistedTimer()
    }

    /// Manual fallback: skip the timer and enter minutes by hand.
    func skipTimer() {
        timerStart = nil
        timerStoppedAt = nil
        isManualEntry = true
        phase = .capture
    }

    func tickTimer() {
        guard isTimerRunning else { return }
        timerTick = Date()
    }

    // MARK: - Persistence (survive backgrounding / relaunch)

    /// Restore a running timer for this restaurant if one was persisted.
    func restoreTimerIfNeeded() {
        guard phase == .idle, timerStart == nil else { return }
        let defaults = UserDefaults.standard
        guard let savedID = defaults.string(forKey: Self.timerRestaurantKey),
              savedID == restaurantID.uuidString,
              let savedStart = defaults.object(forKey: Self.timerStartKey) as? Date
        else { return }
        timerStart = savedStart
        timerStoppedAt = nil
        timerTick = Date()
        isManualEntry = false
        phase = .running
    }

    private func persistTimerStart() {
        guard let timerStart else { return }
        let defaults = UserDefaults.standard
        defaults.set(timerStart, forKey: Self.timerStartKey)
        defaults.set(restaurantID.uuidString, forKey: Self.timerRestaurantKey)
    }

    private func clearPersistedTimer() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: Self.timerStartKey)
        defaults.removeObject(forKey: Self.timerRestaurantKey)
    }

    // MARK: - Submit

    @MainActor
    func submit(api: APIClient) async {
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        let submission = TtfSubmission(
            elapsedMinutes: displayedElapsedMinutes,
            itemType: itemType,
            itemQuality: itemQuality,
            portionSize: portionSize,
            daypart: daypart,
            partySizeKids: partySizeKids,
            waitContext: waitContext.isEmpty ? nil : waitContext
        )

        do {
            _ = try await api.submitTTF(restaurantID: restaurantID, submission: submission)
            clearPersistedTimer()
            successHapticTick += 1
            didSubmit = true
        } catch {
            errorMessage = (error as? APIError)?.userFacingMessage ?? error.localizedDescription
            errorHapticTick += 1
        }
    }
}
