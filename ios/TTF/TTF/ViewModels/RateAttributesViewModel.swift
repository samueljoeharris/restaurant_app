import Foundation
import Observation

@Observable
final class RateAttributesViewModel {
    let restaurantID: UUID

    private(set) var metrics: [MetricDefinition] = []
    private(set) var attributes: [AttributeEntry] = []
    private(set) var isLoading = false
    private(set) var isSubmitting = false
    private(set) var errorMessage: String?
    private(set) var successMessage: String?

    /// Local draft selections keyed by metric key. Nothing is submitted until
    /// `saveAll` runs; untouched metrics simply have no entry here.
    private(set) var drafts: [String: AttributeSubmissionValue] = [:]

    /// Increments once per successful save-all, so the view can trigger
    /// success haptics with `.sensoryFeedback(_:trigger:)`.
    private(set) var completedSaves = 0

    var draftCount: Int { drafts.count }

    init(restaurantID: UUID) {
        self.restaurantID = restaurantID
    }

    func draft(for metricKey: String) -> AttributeSubmissionValue? {
        drafts[metricKey]
    }

    /// Selects `value` for the metric, or deselects it when tapped again.
    @MainActor
    func toggleDraft(_ value: AttributeSubmissionValue, for metricKey: String) {
        if drafts[metricKey] == value {
            drafts.removeValue(forKey: metricKey)
        } else {
            drafts[metricKey] = value
        }
    }

    @MainActor
    func clearSuccessMessage() {
        successMessage = nil
    }

    @MainActor
    func load(api: APIClient) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            async let metricsTask = api.listMetrics()
            async let attributesTask = api.getAttributes(restaurantID: restaurantID)
            metrics = try await metricsTask
            attributes = try await attributesTask
        } catch {
            errorMessage = (error as? APIError)?.userFacingMessage ?? error.localizedDescription
        }
    }

    @MainActor
    func submit(metric: MetricDefinition, value: AttributeSubmissionValue, api: APIClient) async {
        isSubmitting = true
        errorMessage = nil
        successMessage = nil
        defer { isSubmitting = false }

        do {
            try await api.submitAttribute(restaurantID: restaurantID, metricKey: metric.key, value: value)
            successMessage = "Saved \(metric.label)"
            await load(api: api)
        } catch {
            errorMessage = (error as? APIError)?.userFacingMessage ?? error.localizedDescription
        }
    }

    /// Submits every drafted metric via the existing per-metric endpoint,
    /// then refreshes aggregates. Successfully submitted drafts are removed
    /// as they land, so a mid-batch failure leaves only the unsent ones
    /// selected for retry.
    @MainActor
    func saveAll(api: APIClient) async {
        guard !drafts.isEmpty, !isSubmitting else { return }
        isSubmitting = true
        errorMessage = nil
        successMessage = nil
        defer { isSubmitting = false }

        let changed = metrics.filter { drafts[$0.key] != nil }
        var savedCount = 0
        do {
            for metric in changed {
                guard let value = drafts[metric.key] else { continue }
                try await api.submitAttribute(restaurantID: restaurantID, metricKey: metric.key, value: value)
                drafts.removeValue(forKey: metric.key)
                savedCount += 1
            }
            successMessage = savedCount == 1
                ? "Thanks, scout! 🎉 1 rating saved"
                : "Thanks, scout! 🎉 \(savedCount) ratings saved"
            completedSaves += 1
            await load(api: api)
        } catch {
            errorMessage = (error as? APIError)?.userFacingMessage ?? error.localizedDescription
            if savedCount > 0 {
                // Partial success: refresh what did land.
                await load(api: api)
            }
        }
    }
}

extension AttributeSubmissionValue: Equatable {
    static func == (lhs: AttributeSubmissionValue, rhs: AttributeSubmissionValue) -> Bool {
        switch (lhs, rhs) {
        case (.bool(let left), .bool(let right)):
            return left == right
        case (.number(let left), .number(let right)):
            return left == right
        case (.string(let left), .string(let right)):
            return left == right
        default:
            return false
        }
    }
}
