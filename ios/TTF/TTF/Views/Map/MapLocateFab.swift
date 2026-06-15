import SwiftUI

/// Standard map “my location” floating action button — mirrors web `MapLocateFab`.
struct MapLocateFab: View {
    var busy = false
    var active = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if busy {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: "location.fill")
                        .font(.body.weight(.semibold))
                }
            }
            .frame(width: 48, height: 48)
        }
        .buttonStyle(.plain)
        .background(.regularMaterial, in: Circle())
        .overlay {
            Circle()
                .strokeBorder(active ? Color.accentColor : Color.primary.opacity(0.08), lineWidth: active ? 2 : 1)
        }
        .shadow(color: .black.opacity(0.12), radius: 8, y: 2)
        .disabled(busy)
        .accessibilityLabel(busy ? "Finding your location" : "Use my location")
    }
}
