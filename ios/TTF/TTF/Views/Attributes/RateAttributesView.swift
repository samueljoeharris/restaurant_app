import SwiftUI

struct RateAttributesView: View {
    @Environment(APIClient.self) private var api
    let restaurantID: UUID

    @State private var viewModel: RateAttributesViewModel

    init(restaurantID: UUID) {
        self.restaurantID = restaurantID
        _viewModel = State(initialValue: RateAttributesViewModel(restaurantID: restaurantID))
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.metrics.isEmpty {
                ProgressView("Loading metrics…")
            } else if let error = viewModel.errorMessage, viewModel.metrics.isEmpty {
                ContentUnavailableView {
                    Label("Could not load metrics", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(error)
                }
            } else {
                List(viewModel.metrics) { metric in
                    AttributeMetricRow(
                        metric: metric,
                        existing: viewModel.attributes.first { $0.key == metric.key },
                        isSubmitting: viewModel.isSubmitting,
                        onSubmit: { value in
                            Task {
                                await viewModel.submit(metric: metric, value: value, api: api)
                            }
                        }
                    )
                }
            }
        }
        .navigationTitle("Parent attributes")
        .navigationBarTitleDisplayMode(.inline)
        .overlay(alignment: .bottom) {
            if let success = viewModel.successMessage {
                Text(success)
                    .font(.caption)
                    .padding(8)
                    .background(.thinMaterial, in: Capsule())
                    .padding(.bottom, 8)
            }
        }
        .task {
            await viewModel.load(api: api)
        }
    }
}

private struct AttributeMetricRow: View {
    let metric: MetricDefinition
    let existing: AttributeEntry?
    let isSubmitting: Bool
    let onSubmit: (AttributeSubmissionValue) -> Void

    @State private var boolValue = true
    @State private var numericValue = 3
    @State private var enumValue = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(metric.label)
                .font(.headline)
            if let existing {
                Text("Current: \(aggregateLabel(existing)) · \(existing.sampleSize) samples")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            switch metric.metricType {
            case "boolean":
                Toggle("Yes", isOn: $boolValue)
                Button("Save") { onSubmit(.bool(boolValue)) }
                    .disabled(isSubmitting)
            case "numeric":
                Stepper("Rating: \(numericValue)", value: $numericValue, in: (metric.minValue ?? 1) ... (metric.maxValue ?? 5))
                Button("Save") { onSubmit(.number(Double(numericValue))) }
                    .disabled(isSubmitting)
            case "enum":
                if let values = metric.enumValues, !values.isEmpty {
                    Picker("Value", selection: $enumValue) {
                        ForEach(values, id: \.self) { value in
                            Text(value).tag(value)
                        }
                    }
                    .onAppear {
                        if enumValue.isEmpty { enumValue = values[0] }
                    }
                    Button("Save") { onSubmit(.string(enumValue)) }
                        .disabled(isSubmitting)
                }
            default:
                Text("Unsupported metric type: \(metric.metricType)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private func aggregateLabel(_ entry: AttributeEntry) -> String {
        guard let value = entry.aggregate?.value else { return "—" }
        switch value {
        case .bool(let bool):
            return bool ? "Yes" : "No"
        case .number(let number):
            return String(format: "%.1f", number)
        case .string(let string):
            return string
        case .null:
            return "—"
        }
    }
}
