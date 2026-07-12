import SwiftUI

/// Map marker matching web `MapPin` — teardrop body, optional label, contribution badges.
struct TierPinView: View {
    let entry: RestaurantMapEntry
    var selected = false
    var searchFocus = false

    private var pinKind: MapPinKind { MapPinLogic.kind(for: entry) }
    private var fill: Color { MapPinLogic.fill(for: entry, searchFocus: searchFocus) }
    private var label: String? { MapPinLogic.label(for: entry) }

    private var pinWidth: CGFloat { searchFocus ? 18 : 14 }

    var body: some View {
        VStack(spacing: 2) {
            if searchFocus {
                pinLabel("★", search: true)
            } else if let label {
                pinLabel(label, search: false)
            }

            WebTeardropPinShape()
                .fill(fill)
                .frame(width: pinWidth, height: pinWidth)
                .overlay {
                    WebTeardropPinShape()
                        .stroke(.white, lineWidth: searchFocus ? 3 : 2)
                }
                .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
                .overlay {
                    if pinKind == .earlyTtf {
                        WebTeardropPinShape()
                            .stroke(.white, style: StrokeStyle(lineWidth: 2, dash: [3, 2]))
                            .padding(-2)
                    }
                }
                .overlay {
                    if selected || searchFocus {
                        WebTeardropPinShape()
                            .stroke(fill.opacity(0.4), lineWidth: searchFocus ? 4 : 3)
                            .padding(searchFocus ? -4 : -3)
                    }
                }

            let badges = MapPinLogic.badges(for: entry)
            if badges.ratings || badges.notes {
                HStack(spacing: 2) {
                    if badges.ratings {
                        pinBadge("★", title: "Parent ratings")
                    }
                    if badges.notes {
                        pinBadge("💬", title: "Parent notes")
                    }
                }
                .offset(y: -2)
            }
        }
        .scaleEffect(selected ? 1.15 : 1)
        .opacity(pinKind == .earlyTtf ? 0.85 : 1)
        .animation(.easeOut(duration: 0.15), value: selected)
        .accessibilityLabel(MapPinLogic.tooltip(for: entry).replacingOccurrences(of: "\n", with: ". "))
    }

    private func pinLabel(_ text: String, search: Bool) -> some View {
        Text(text)
            .font(search ? .lsBody(11, weight: .bold) : .lsBody(10, weight: .bold))
            .foregroundStyle(search ? Color.brand : Color.text)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.surface, in: Capsule())
            .overlay {
                Capsule()
                    .strokeBorder(fill, lineWidth: 1.5)
            }
            .shadow(color: .black.opacity(0.15), radius: 1.5, y: 1)
    }

    private func pinBadge(_ text: String, title: String) -> some View {
        Text(text)
            .font(.system(size: 9))
            .padding(.horizontal, 3)
            .padding(.vertical, 1)
            .background(Color.surface, in: Capsule())
            .shadow(color: .black.opacity(0.2), radius: 1, y: 1)
            .accessibilityLabel(title)
    }
}

/// Teardrop map pin — matches web `.map-pin__drop` (rounded square rotated −45°).
private struct WebTeardropPinShape: Shape {
    func path(in rect: CGRect) -> Path {
        let side = min(rect.width, rect.height)
        let square = CGRect(
            x: rect.midX - side / 2,
            y: rect.midY - side / 2,
            width: side,
            height: side
        )
        let radius = side / 2
        var path = Path()
        path.addRoundedRect(
            in: square,
            cornerRadii: RectangleCornerRadii(
                topLeading: radius,
                bottomLeading: 0,
                bottomTrailing: radius,
                topTrailing: radius
            )
        )
        let transform = CGAffineTransform(translationX: rect.midX, y: rect.midY)
            .rotated(by: -.pi / 4)
            .translatedBy(x: -rect.midX, y: -rect.midY)
        return path.applying(transform)
    }
}
