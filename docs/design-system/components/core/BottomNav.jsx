import React from "react";

/**
 * Mobile bottom tab bar. Active tab in sky blue.
 */
export function BottomNav({ items = [], style }) {
  return (
    <div
      style={{
        display: "flex",
        borderTop: "1px solid #EFE6D3",
        padding: "9px 6px 13px",
        background: "var(--ls-surface)",
        ...style,
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          onClick={it.onClick}
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: "var(--ls-font-display)",
            fontWeight: 700,
            fontSize: 10,
            color: it.active ? "var(--ls-sky)" : "#B8AB97",
            cursor: it.onClick ? "pointer" : "default",
          }}
        >
          <div style={{ fontSize: 16, lineHeight: 1.1 }} aria-hidden="true">{it.icon}</div>
          {it.label}
        </div>
      ))}
    </div>
  );
}
