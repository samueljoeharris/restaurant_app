import SwiftUI

/// Dropdown list of autocomplete suggestions rendered below the search field.
struct PlaceSearchSuggestionsView: View {
    let suggestions: [PlaceSuggestion]
    let onSelect: (PlaceSuggestion) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(suggestions) { suggestion in
                Button {
                    onSelect(suggestion)
                } label: {
                    suggestionRow(suggestion)
                }
                .buttonStyle(.plain)

                if suggestion.id != suggestions.last?.id {
                    Divider()
                        .padding(.leading, 44)
                }
            }
        }
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .shadow(color: .black.opacity(0.12), radius: 8, x: 0, y: 4)
    }

    @ViewBuilder
    private func suggestionRow(_ suggestion: PlaceSuggestion) -> some View {
        HStack(spacing: 12) {
            Image(systemName: suggestion.type == "restaurant" ? "fork.knife" : "mappin.circle.fill")
                .foregroundStyle(suggestion.type == "restaurant" ? Color.brand : Color.textMuted)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(suggestion.primaryText)
                    .font(.body)
                    .foregroundStyle(Color.text)
                    .lineLimit(1)
                Text(suggestion.secondaryText ?? "")
                    .font(.caption)
                    .foregroundStyle(Color.textMuted)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }
}
