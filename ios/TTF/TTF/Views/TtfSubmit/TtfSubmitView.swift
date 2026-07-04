import SwiftUI

/// Two-moment TTF flow: "We just ordered" → live timer → "Food's here!" → one quick-capture screen.
/// Designed for one hand and under 60 seconds of attention during a meal.
struct TtfSubmitView: View {
    @Environment(APIClient.self) private var api
    @Environment(\.dismiss) private var dismiss

    @State private var viewModel: TtfSubmitViewModel
    @State private var timerTask: Task<Void, Never>?

    init(restaurantID: UUID) {
        _viewModel = State(initialValue: TtfSubmitViewModel(restaurantID: restaurantID))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if viewModel.restaurantName.isEmpty, let error = viewModel.errorMessage {
                    ContentUnavailableView {
                        Label("Could not load restaurant", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") {
                            Task { await viewModel.loadRestaurant(api: api) }
                        }
                    }
                    .padding(.top, 48)
                } else {
                    switch viewModel.phase {
                    case .idle:
                        idleMoment
                    case .running:
                        runningMoment
                    case .capture:
                        captureMoment
                    }
                }
            }
            .padding(20)
            .animation(.easeOut(duration: 0.2), value: viewModel.phase)
        }
        .background(Color.bg)
        .navigationTitle("Kid food speed")
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.success, trigger: viewModel.successHapticTick)
        .sensoryFeedback(.error, trigger: viewModel.errorHapticTick)
        .task {
            viewModel.restoreTimerIfNeeded()
            if viewModel.phase == .running {
                startTicker()
            }
            await viewModel.loadRestaurant(api: api)
        }
        .onChange(of: viewModel.phase) { _, phase in
            if phase == .running {
                startTicker()
            } else {
                stopTicker()
            }
        }
        .onChange(of: viewModel.didSubmit) { _, submitted in
            if submitted { dismiss() }
        }
        .onDisappear {
            stopTicker()
        }
    }

    // MARK: - Moment 1: idle

    private var idleMoment: some View {
        VStack(spacing: 16) {
            restaurantHeader

            Text("Tap when the kid food is ordered — we'll keep time so you can keep parenting.")
                .font(.subheadline)
                .foregroundStyle(Color.textMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)

            Spacer().frame(height: 24)

            Button {
                viewModel.startTimer()
            } label: {
                Text("We just ordered")
            }
            .buttonStyle(BigPrimaryButtonStyle())

            Button("Skip timer — enter minutes") {
                viewModel.skipTimer()
            }
            .font(.subheadline)
            .foregroundStyle(Color.textMuted)
            .padding(.top, 4)
        }
        .padding(.top, 32)
    }

    // MARK: - Moment between: running timer

    private var runningMoment: some View {
        VStack(spacing: 16) {
            restaurantHeader

            Text("Timing the kid food")
                .font(.subheadline)
                .foregroundStyle(Color.textMuted)

            Text(viewModel.timerLabel)
                .font(.system(size: 76, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Color.brand)
                .contentTransition(.numericText())
                .accessibilityLabel("Elapsed time")
                .accessibilityValue(viewModel.timerLabel)
                .padding(.vertical, 24)

            Button {
                viewModel.foodArrived()
            } label: {
                Text("Food's here!")
            }
            .buttonStyle(BigPrimaryButtonStyle())

            Button("Cancel timer") {
                viewModel.cancelTimer()
            }
            .font(.subheadline)
            .foregroundStyle(Color.textMuted)
            .padding(.top, 4)
        }
        .padding(.top, 32)
    }

    // MARK: - Moment 2: quick capture

    private var captureMoment: some View {
        VStack(alignment: .leading, spacing: 20) {
            capturedTimeHeader

            VStack(alignment: .leading, spacing: 10) {
                sectionLabel("What arrived?")
                PillGrid(
                    options: TtfItemType.allCases,
                    label: { "\($0.emoji) \($0.label)" },
                    selection: $viewModel.itemType
                )
            }

            VStack(alignment: .leading, spacing: 10) {
                sectionLabel("How was it?")
                StarRatingRow(rating: $viewModel.itemQuality)
            }

            VStack(alignment: .leading, spacing: 10) {
                sectionLabel("Portion size")
                PillGrid(
                    options: TtfPortionSize.allCases,
                    label: { $0.label },
                    selection: $viewModel.portionSize
                )
            }

            VStack(alignment: .leading, spacing: 10) {
                sectionLabel("Time of day")
                PillGrid(
                    options: TtfDaypart.allCases,
                    label: { $0.label },
                    selection: $viewModel.daypart
                )
            }

            Stepper(value: $viewModel.partySizeKids, in: 1 ... 12) {
                HStack(spacing: 6) {
                    Text("Kids in your party")
                        .foregroundStyle(Color.text)
                    Text("\(viewModel.partySizeKids)")
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.brand)
                        .monospacedDigit()
                }
            }
            .padding(.vertical, 4)

            VStack(alignment: .leading, spacing: 10) {
                sectionLabel("Anything worth noting? (optional)")
                TextField("Busy kitchen, high chair delay…", text: $viewModel.waitContext, axis: .vertical)
                    .lineLimit(2 ... 4)
                    .padding(12)
                    .background(Color.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .overlay {
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(Color.border)
                    }
            }

            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.subheadline)
                    .foregroundStyle(Color.error)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task { await viewModel.submit(api: api) }
            } label: {
                if viewModel.isSubmitting {
                    HStack(spacing: 10) {
                        ProgressView().tint(Color.textInverse)
                        Text("Logging…")
                    }
                } else {
                    Text("Log it 🎉")
                }
            }
            .buttonStyle(BigPrimaryButtonStyle())
            .disabled(viewModel.isSubmitting)
            .padding(.top, 4)
        }
    }

    // MARK: - Shared pieces

    private var restaurantHeader: some View {
        Group {
            if viewModel.isLoadingRestaurant && viewModel.restaurantName.isEmpty {
                HStack(spacing: 8) {
                    ProgressView()
                    Text("Loading restaurant…")
                        .foregroundStyle(Color.textMuted)
                }
            } else if !viewModel.restaurantName.isEmpty {
                Text(viewModel.restaurantName)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Color.text)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var capturedTimeHeader: some View {
        VStack(spacing: 8) {
            if viewModel.isManualEntry {
                sectionLabel("How long did the kid food take?")
                    .frame(maxWidth: .infinity, alignment: .leading)
                Stepper(value: $viewModel.elapsedMinutes, in: 1 ... 180) {
                    HStack(spacing: 6) {
                        Text("\(viewModel.elapsedMinutes)")
                            .font(.title2.weight(.bold))
                            .foregroundStyle(Color.brand)
                            .monospacedDigit()
                        Text(viewModel.elapsedMinutes == 1 ? "minute" : "minutes")
                            .foregroundStyle(Color.text)
                    }
                }
                .padding(.vertical, 2)
            } else {
                Text("Food arrived in")
                    .font(.subheadline)
                    .foregroundStyle(Color.textMuted)
                Text(viewModel.timerLabel)
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Color.brand)
                    .accessibilityLabel("Elapsed time")
                    .accessibilityValue(viewModel.timerLabel)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.text)
    }

    private func startTicker() {
        stopTicker()
        timerTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                await MainActor.run {
                    viewModel.tickTimer()
                }
            }
        }
    }

    private func stopTicker() {
        timerTask?.cancel()
        timerTask = nil
    }
}

// MARK: - Private components

/// Full-width, thumb-sized primary action — one per surface.
private struct BigPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title3.weight(.semibold))
            .foregroundStyle(Color.textInverse)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(isEnabled ? Color.brand : Color.brand.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .opacity(configuration.isPressed ? 0.85 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

/// Tappable 1–5 star row with big one-handed targets.
private struct StarRatingRow: View {
    @Binding var rating: Int

    var body: some View {
        HStack(spacing: 8) {
            ForEach(1 ... 5, id: \.self) { star in
                Button {
                    rating = star
                } label: {
                    Image(systemName: star <= rating ? "star.fill" : "star")
                        .font(.system(size: 30))
                        .foregroundStyle(star <= rating ? Color.accent : Color.border)
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(star == 1 ? "1 star" : "\(star) stars")
                .accessibilityAddTraits(star == rating ? [.isSelected] : [])
            }
        }
        .animation(.easeOut(duration: 0.15), value: rating)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Quality rating")
        .accessibilityValue(rating == 1 ? "1 star" : "\(rating) stars")
    }
}

/// Wrapping row of tappable selection pills.
private struct PillGrid<Option: Identifiable & Equatable>: View {
    let options: [Option]
    let label: (Option) -> String
    @Binding var selection: Option

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 8)], spacing: 8) {
            ForEach(options) { option in
                let isSelected = option == selection
                Button {
                    selection = option
                } label: {
                    Text(label(option))
                        .font(.subheadline.weight(isSelected ? .semibold : .regular))
                        .foregroundStyle(isSelected ? Color.textInverse : Color.text)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(isSelected ? Color.brand : Color.surface)
                        .clipShape(Capsule())
                        .overlay {
                            Capsule().strokeBorder(isSelected ? Color.clear : Color.border)
                        }
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? [.isSelected] : [])
            }
        }
        .animation(.easeOut(duration: 0.15), value: selection)
    }
}
