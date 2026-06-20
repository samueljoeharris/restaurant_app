import React from "react";

/**
 * Parent-attribute pill (high chairs, changing table, filters…).
 */
export function AttributeChip({ label, icon, active = false, dashed = false, style, ...rest }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontFamily: "var(--ls-font-body)",
    fontWeight: 700,
    fontSize: 12,
    padding: "8px 13px",
    borderRadius: "var(--ls-radius-full)",
    cursor: rest.onClick ? "pointer" : "default",
    whiteSpace: "nowrap",
  };
  const skin = active
    ? { background: "var(--ls-sky)", color: "#fff", border: "1.5px solid var(--ls-sky)" }
    : dashed
    ? { background: "var(--ls-surface)", color: "var(--ls-ink-muted)", border: "1.5px dashed var(--ls-border-strong)" }
    : { background: "var(--ls-surface)", color: "#5E5446", border: "1.5px solid var(--ls-border)" };
  return (
    <span style={{ ...base, ...skin, ...style }} {...rest}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {label}
    </span>
  );
}
