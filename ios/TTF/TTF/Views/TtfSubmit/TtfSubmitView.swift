import SwiftUI

struct TtfSubmitView: View {
    @Environment(APIClient.self) private var api
    @Environment(\.dismiss) private var dismiss

    @State private var viewModel: TtfSubmitViewModel
    @State private var timerTask: Task<Void, Never>?

    init(restaurantID: UUID) {
        _viewModel = State(initialValue: TtfSubmitViewModel(restaurantID: restaurantID))
    }

    var body: some View {
        Form {
            if viewModel.isLoadingRestaurant && viewModel.restaurantName.isEmpty {
                Section {
                    HStack {
                        ProgressView()
                        Text("Loading restaurant…")
                            .foregroundStyle(.secondary)
                    }
                }
            } else if !viewModel.restaurantName.isEmpty {
                Section {
                    Text(viewModel.restaurantName)
                }
            } else if let error = viewModel.errorMessage, viewModel.restaurantName.isEmpty {
                Section {
                    ContentUnavailableView {
                        Label("Could not load restaurant", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") {
                            Task { await viewModel.loadRestaurant(api: api) }
                        }
                    }
                }
            }

            Section("Timer") {
                Text(viewModel.timerLabel)
                    .font(.system(.largeTitle, design: .monospaced))
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel("Elapsed time")
                    .accessibilityValue(viewModel.timerLabel)

                HStack {
                    Button(viewModel.isTimerRunning ? "Stop" : "Start") {
                        if viewModel.isTimerRunning {
                            viewModel.stopTimer()
                            stopTicker()
                        } else {
                            viewModel.startTimer()
                            startTicker()
                        }
                    }
                    .buttonStyle(.borderedProminent)

                    Button("Reset") {
                        viewModel.resetTimer()
                        stopTicker()
                    }
                    .buttonStyle(.bordered)
                }

                Stepper("Manual minutes: \(viewModel.elapsedMinutes)", value: $viewModel.elapsedMinutes, in: 1 ... 180)
                    .disabled(viewModel.isTimerRunning)
            }

            Section("What arrived?") {
                Picker("Item type", selection: $viewModel.itemType) {
                    ForEach(TtfItemType.allCases) { type in
                        Text("\(type.emoji) \(type.label)").tag(type)
                    }
                }

                Stepper("Quality: \(viewModel.itemQuality)", value: $viewModel.itemQuality, in: 1 ... 5)

                Picker("Portion", selection: $viewModel.portionSize) {
                    ForEach(TtfPortionSize.allCases) { portion in
                        Text(portion.label).tag(portion)
                    }
                }

                Picker("Daypart", selection: $viewModel.daypart) {
                    ForEach(TtfDaypart.allCases) { part in
                        Text(part.label).tag(part)
                    }
                }

                Stepper("Kids in party: \(viewModel.partySizeKids)", value: $viewModel.partySizeKids, in: 1 ... 12)
            }

            Section("Context (optional)") {
                TextField("Busy kitchen, high chair delay…", text: $viewModel.waitContext, axis: .vertical)
                    .lineLimit(2 ... 4)
            }

            if let error = viewModel.errorMessage {
                Section {
                    Text(error).foregroundStyle(.red)
                }
            }

            Section {
                Button(viewModel.isSubmitting ? "Submitting…" : "Submit TTF") {
                    Task { await viewModel.submit(api: api) }
                }
                .disabled(viewModel.isSubmitting)
            }
        }
        .navigationTitle("Submit TTF")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadRestaurant(api: api)
        }
        .onChange(of: viewModel.didSubmit) { _, submitted in
            if submitted { dismiss() }
        }
        .onDisappear {
            stopTicker()
        }
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
