import SwiftUI

struct RateAttributesView: View {
    @Environment(APIClient.self) private var api
    let restaurantID: UUID

    @State private var viewModel: RateAttributesViewModel
    @State private var toastTask: Task<Void, Never>?

    init(restaurantID: UUID) {
        self.restaurantID = restaurantID
        _viewModel = State(initialValue: RateAttributesViewModel(restaurantID: restaurantID))
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.metrics.isEmpty {
                ProgressView("Loading metrics…")
            } else if let error = viewModel.errorMessage, viewModel.metrics.isEmpty {
                ErrorStateView(message: error) {
                    Task { await viewModel.load(api: api) }
                }
            } else {
                metricList
            }
        }
        .navigationTitle("Parent attributes")
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.success, trigger: viewModel.completedSaves)
        .task {
            await viewModel.load(api: api)
        }
        .onChange(of: viewModel.successMessage) { _, message in
            toastTask?.cancel()
            guard message != nil else { return }
            toastTask = Task {
                try? await Task.sleep(for: .seconds(3))
                guard !Task.isCancelled else { return }
                viewModel.clearSuccessMessage()
            }
        }
        .onDisappear {
            toastTask?.cancel()
        }
    }

    private var metricList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Tap what you know — every answer helps another parent.")
                    .font(.subheadline)
                    .foregroundStyle(Color.textMuted)
                    .padding(.horizontal, 4)

                ForEach(viewModel.metrics) { metric in
                    MetricDraftCard(
                        metric: metric,
                        existing: viewModel.attributes.first { $0.key == metric.key },
                        draft: viewModel.draft(for: metric.key),
                        onToggle: { value in
                            viewModel.toggleDraft(value, for: metric.key)
                        }
                    )
                }
            }
            .padding(.horizontal)
            .padding(.top, 12)
            .padding(.bottom, 16)
        }
        .scrollDismissesKeyboard(.immediately)
        .safeAreaInset(edge: .bottom) {
            saveBar
        }
    }

    private var saveBar: some View {
        VStack(spacing: 10) {
            if let success = viewModel.successMessage {
                Text(success)
                    .font(.caption)
                    .padding(8)
                    .background(.thinMaterial, in: Capsule())
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }

            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(Color.error)
                    .multilineTextAlignment(.center)
            }

            Button {
                Task { await viewModel.saveAll(api: api) }
            } label: {
                Text(saveButtonLabel)
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 4)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.brand)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .disabled(viewModel.draftCount == 0 || viewModel.isSubmitting)
        }
        .padding(.horizontal)
        .padding(.top, 10)
        .padding(.bottom, 6)
        .background(.bar)
        .animation(.easeOut(duration: 0.25), value: viewModel.successMessage)
        .animation(.easeOut(duration: 0.15), value: viewModel.draftCount)
    }

    private var saveButtonLabel: String {
        if viewModel.isSubmitting {
            return "Saving…"
        }
        switch viewModel.draftCount {
        case 0:
            return "Save"
        case 1:
            return "Save 1 rating"
        default:
            return "Save \(viewModel.draftCount) ratings"
        }
    }
}

// MARK: - Metric card

private struct MetricDraftCard: View {
    let metric: MetricDefinition
    let existing: AttributeEntry?
    let draft: AttributeSubmissionValue?
    let onToggle: (AttributeSubmissionValue) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(metric.label)
                .font(.headline)

            if let existing {
                Text("Parents say: \(aggregateLabel(existing)) · \(existing.sampleSize) samples")
                    .font(.caption)
                    .foregroundStyle(Color.textMuted)
            }

            control
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18)
                .fill(Color.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(draft == nil ? Color.border : Color.brand.opacity(0.5), lineWidth: 1)
        )
        .animation(.easeOut(duration: 0.15), value: draft == nil)
    }

    @ViewBuilder
    private var control: some View {
        switch metric.metricType {
        case "boolean":
            BooleanChipRow(draft: draft, onToggle: onToggle)
        case "numeric":
            NumericStarRow(metric: metric, draft: draft, onToggle: onToggle)
        case "enum":
            if let values = metric.enumValues, !values.isEmpty {
                EnumPillRow(values: values, draft: draft, onToggle: onToggle)
            }
        default:
            Text("Unsupported metric type: \(metric.metricType)")
                .font(.caption)
                .foregroundStyle(Color.textMuted)
        }
    }

    private func aggregateLabel(_ entry: AttributeEntry) -> String {
        guard let value = entry.aggregate?.value else { return "—" }
        switch value {
        case .bool(let bool):
            return bool ? "Yes" : "No"
        case .number(let number):
            return String(format: "%.1f", number)
        case .string(let string):
            return string.humanReadableEnumLabel
        case .null:
            return "—"
        }
    }
}

// MARK: - Boolean chips

private struct BooleanChipRow: View {
    let draft: AttributeSubmissionValue?
    let onToggle: (AttributeSubmissionValue) -> Void

    var body: some View {
        HStack(spacing: 8) {
            AttributeChip(
                label: "Yes",
                isSelected: draft == .bool(true),
                fillsWidth: true
            ) {
                onToggle(.bool(true))
            }
            AttributeChip(
                label: "No",
                isSelected: draft == .bool(false),
                fillsWidth: true
            ) {
                onToggle(.bool(false))
            }
        }
    }
}

// MARK: - Numeric star row

private struct NumericStarRow: View {
    let metric: MetricDefinition
    let draft: AttributeSubmissionValue?
    let onToggle: (AttributeSubmissionValue) -> Void

    private var range: ClosedRange<Int> {
        let lower = metric.minValue ?? 1
        let upper = Swift.max(lower, metric.maxValue ?? 5)
        return lower ... upper
    }

    private var selectedValue: Int? {
        if case .number(let number) = draft {
            return Int(number)
        }
        return nil
    }

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(range), id: \.self) { value in
                let isFilled = selectedValue.map { value <= $0 } ?? false
                Button {
                    onToggle(.number(Double(value)))
                } label: {
                    Image(systemName: isFilled ? "star.fill" : "star")
                        .font(.title2)
                        .foregroundStyle(isFilled ? Color.accentPop : Color.textMuted)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(value) out of \(range.upperBound)")
                .accessibilityAddTraits(selectedValue == value ? .isSelected : [])
            }
        }
        .animation(.easeOut(duration: 0.15), value: selectedValue)
        .accessibilityElement(children: .contain)
        .accessibilityHint("Tap a star to rate. Tap the same star again to clear.")
    }
}

// MARK: - Enum pills

private struct EnumPillRow: View {
    let values: [String]
    let draft: AttributeSubmissionValue?
    let onToggle: (AttributeSubmissionValue) -> Void

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
            alignment: .leading,
            spacing: 8
        ) {
            ForEach(values, id: \.self) { value in
                AttributeChip(
                    label: value.humanReadableEnumLabel,
                    isSelected: draft == .string(value),
                    fillsWidth: true
                ) {
                    onToggle(.string(value))
                }
            }
        }
    }
}

// MARK: - Chip

private struct AttributeChip: View {
    let label: String
    let isSelected: Bool
    var fillsWidth = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.vertical, 10)
                .padding(.horizontal, 14)
                .frame(maxWidth: fillsWidth ? .infinity : nil)
                .background(
                    Capsule().fill(isSelected ? Color.brandSoft : Color.surfaceMuted)
                )
                .overlay(
                    Capsule().stroke(isSelected ? Color.brand : Color.border, lineWidth: 1)
                )
                .foregroundStyle(isSelected ? Color.brand : Color.text)
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.15), value: isSelected)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

// MARK: - Helpers

private extension String {
    /// "kids_menu_quality" → "Kids menu quality" (sentence case, underscores removed).
    var humanReadableEnumLabel: String {
        let spaced = replacingOccurrences(of: "_", with: " ")
        guard let first = spaced.first else { return spaced }
        return first.uppercased() + spaced.dropFirst()
    }
}
