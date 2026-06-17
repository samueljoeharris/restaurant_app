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

    init(restaurantID: UUID) {
        self.restaurantID = restaurantID
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
}
