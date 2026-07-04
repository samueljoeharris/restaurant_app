import SwiftUI

/// Rounded surface card matching web `Card` — title, optional subtitle, themed border/shadow.
struct ScoutCard<Content: View>: View {
    var title: String?
    var subtitle: String?
    var accent = false
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if title != nil || subtitle != nil {
                VStack(alignment: .leading, spacing: 4) {
                    if let title {
                        Text(title)
                            .font(.lsHeadline)
                            .foregroundStyle(Color.text)
                    }
                    if let subtitle {
                        Text(subtitle)
                            .font(.lsBody(14))
                            .foregroundStyle(Color.textMuted)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 4)
            }

            content()
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.top, title == nil && subtitle == nil ? 16 : 12)
                .padding(.bottom, 20)
        }
        .background {
            if accent {
                LinearGradient(
                    colors: [Color.brandSoft, Color.surface],
                    startPoint: .top,
                    endPoint: UnitPoint(x: 0.5, y: 0.4)
                )
            } else {
                Color.surface
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay {
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(accent ? Color.brand.opacity(0.25) : Color.border)
        }
        .shadow(color: Color.text.opacity(0.06), radius: 2, y: 1)
    }
}
