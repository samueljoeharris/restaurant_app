import React from "react";

const DOT = {
  fast: "var(--ls-ttf-fast)",
  ok: "var(--ls-ttf-ok)",
  slow: "var(--ls-ttf-slow)",
  none: "var(--ls-ttf-none)",
};

/**
 * Feed card for an update on a saved spot.
 */
export function UpdateCard({ name, tier = "fast", time, children, isNew = false, style, ...rest }) {
  return (
    <div
      style={{
        background: "var(--ls-surface)",
        border: "1px solid #EFE6D3",
        borderRadius: "var(--ls-radius-lg)",
        padding: 13,
        boxShadow: "var(--ls-shadow-sm)",
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: DOT[tier] }} />
        <span style={{ fontFamily: "var(--ls-font-display)", fontWeight: 700, fontSize: 13, color: "var(--ls-ink)" }}>{name}</span>
        {isNew ? (
          <span style={{ fontFamily: "var(--ls-font-body)", fontWeight: 700, fontSize: 10, color: "var(--ls-pop)", background: "var(--ls-pop-soft)", padding: "2px 8px", borderRadius: "var(--ls-radius-full)", marginLeft: "auto" }}>
            New
          </span>
        ) : time ? (
          <span style={{ fontFamily: "var(--ls-font-body)", fontWeight: 700, fontSize: 11, color: "var(--ls-ink-muted)", marginLeft: "auto" }}>{time}</span>
        ) : null}
      </div>
      <div style={{ fontFamily: "var(--ls-font-body)", fontWeight: 600, fontSize: 12.5, color: "#5E5446", lineHeight: 1.4 }}>{children}</div>
    </div>
  );
}
