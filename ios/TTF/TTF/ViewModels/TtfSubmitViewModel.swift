import Foundation
import Observation

@Observable
final class TtfSubmitViewModel {
    let restaurantID: UUID

    private(set) var restaurantName = ""
    private(set) var isLoadingRestaurant = false
    private(set) var isSubmitting = false
    private(set) var errorMessage: String?
    private(set) var didSubmit = false

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
            errorMessage = error.localizedDescription
        }
    }

    func startTimer() {
        timerStart = Date()
        timerStoppedAt = nil
        timerTick = Date()
    }

    func stopTimer() {
        guard isTimerRunning else { return }
        timerStoppedAt = Date()
        timerTick = timerStoppedAt ?? Date()
        elapsedMinutes = displayedElapsedMinutes
    }

    func resetTimer() {
        timerStart = nil
        timerStoppedAt = nil
        timerTick = Date()
    }

    func tickTimer() {
        guard isTimerRunning else { return }
        timerTick = Date()
    }

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
            didSubmit = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
