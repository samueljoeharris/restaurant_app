import React from "react";

/**
 * Little Scout primary action button. Sky-blue brand fill by default.
 */
export function Button({ variant = "primary", size = "md", children, style, ...rest }) {
  const sizes = {
    sm: { padding: "9px 16px", fontSize: 13 },
    md: { padding: "12px 22px", fontSize: 14 },
    lg: { padding: "14px 26px", fontSize: 15 },
  };
  const variants = {
    primary: {
      background: "var(--ls-sky)",
      color: "#fff",
      border: "none",
      boxShadow: "var(--ls-shadow-brand)",
    },
    secondary: {
      background: "var(--ls-surface)",
      color: "var(--ls-sky-deep)",
      border: "1.5px solid var(--ls-sky-soft)",
    },
    soft: {
      background: "var(--ls-mango-soft)",
      color: "var(--ls-mango-deep)",
      border: "none",
    },
    ghost: {
      background: "transparent",
      color: "var(--ls-ink-muted)",
      border: "none",
      boxShadow: "none",
    },
  };
  return (
    <button
      style={{
        fontFamily: "var(--ls-font-display)",
        fontWeight: 700,
        borderRadius: "var(--ls-radius-button)",
        cursor: "pointer",
        transition: "transform var(--ls-dur-fast) var(--ls-ease-out), filter var(--ls-dur-fast)",
        ...sizes[size],
        ...variants[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
