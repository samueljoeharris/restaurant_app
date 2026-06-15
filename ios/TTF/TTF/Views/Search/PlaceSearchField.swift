import SwiftUI

/// Reusable place/restaurant search field with autocomplete dropdown.
struct PlaceSearchField: View {
    @Bindable var viewModel: PlaceSearchViewModel
    @Binding var searchText: String
    var placeholder = "Search by restaurant name or place"

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField(placeholder, text: $searchText)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .onChange(of: searchText) { _, newValue in
                    viewModel.queryChanged(newValue)
                }

            if !viewModel.suggestions.isEmpty {
                PlaceSearchSuggestionsView(suggestions: viewModel.suggestions) { suggestion in
                    viewModel.select(suggestion)
                    searchText = suggestion.primaryText
                }
            }
        }
    }
}
