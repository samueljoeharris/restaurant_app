import React from "react";

/**
 * Rounded pill toggle in brand sky / ivory track.
 */
export function Toggle({ checked = false, onChange, label, style }) {
  const track = (
    <span
      role="switch"
      aria-checked={checked}
      onClick={() => onChange && onChange(!checked)}
      style={{
        width: 42,
        height: 24,
        borderRadius: "var(--ls-radius-full)",
        background: checked ? "var(--ls-sky)" : "var(--ls-border-strong)",
        position: "relative",
        flex: "none",
        cursor: "pointer",
        transition: "background var(--ls-dur-fast) var(--ls-ease-out)",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,.15)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,.2)",
          transition: "left var(--ls-dur-fast) var(--ls-ease-out)",
        }}
      />
    </span>
  );
  if (!label) return track;
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, ...style }}>
      {track}
      <span style={{ fontFamily: "var(--ls-font-body)", fontWeight: 700, fontSize: 13, color: "var(--ls-ink)" }}>{label}</span>
    </label>
  );
}
