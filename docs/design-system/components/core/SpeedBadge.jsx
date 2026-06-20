import React from "react";

const TIERS = {
  fast: { color: "var(--ls-ttf-fast)", soft: "var(--ls-ttf-fast-soft)", label: "Fast" },
  ok: { color: "var(--ls-ttf-ok)", soft: "var(--ls-ttf-ok-soft)", label: "OK" },
  slow: { color: "var(--ls-ttf-slow)", soft: "var(--ls-ttf-slow-soft)", label: "Slow" },
  none: { color: "var(--ls-ttf-none)", soft: "var(--ls-ttf-none-soft)", label: "No data" },
};

/**
 * Flagship "kid food speed" badge — the loudest element on a detail page.
 */
export function SpeedBadge({ minutes, tier = "fast", caption, meta, style }) {
  const t = TIERS[tier] || TIERS.fast;
  return (
    <div
      style={{
        background: "#FBF8F0",
        border: "1px solid #EFE6D3",
        borderRadius: "var(--ls-radius-lg)",
        padding: 16,
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: "var(--ls-font-body)",
          fontWeight: 800,
          fontSize: 10,
          letterSpacing: "var(--ls-tracking-label)",
          textTransform: "uppercase",
          color: "var(--ls-ink-muted)",
          marginBottom: 8,
        }}
      >
        {caption || "Kid food speed"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: t.color,
            boxShadow: `0 0 0 4px ${t.soft}`,
          }}
        />
        <span style={{ fontFamily: "var(--ls-font-display)", fontWeight: 700, fontSize: 38, lineHeight: 1, color: "var(--ls-ink)" }}>
          {minutes != null ? `${minutes} min` : "—"}
        </span>
        <span
          style={{
            fontFamily: "var(--ls-font-display)",
            fontWeight: 700,
            fontSize: 13,
            color: t.color,
            background: t.soft,
            padding: "5px 11px",
            borderRadius: "var(--ls-radius-full)",
          }}
        >
          {t.label}
        </span>
      </div>
      {meta ? (
        <div style={{ fontFamily: "var(--ls-font-body)", fontWeight: 600, fontSize: 12, color: "var(--ls-ink-muted)", marginTop: 8 }}>
          {meta}
        </div>
      ) : null}
    </div>
  );
}
