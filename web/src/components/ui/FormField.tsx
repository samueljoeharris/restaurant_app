import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";

/**
 * Standard labeled form control (layout conventions, issue #60).
 *
 * Wraps a text input / select / textarea in a `<label>` so the control keeps
 * the global stacked layout from globals.css (`label { grid gap-2 }` plus
 * `w-full` control sizing). Checkbox/radio rows must NOT use this — use
 * `CheckboxField` (flex row) instead, or the control stacks under the label.
 */
export function FormField({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  /** Secondary helper copy rendered under the control. */
  hint?: ReactNode;
  /** Field-level error rendered under the control. */
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={className}>
      {label}
      {children}
      {hint ? <span className="text-xs font-normal text-text-muted">{hint}</span> : null}
      {error ? <span className="text-xs font-semibold text-error">{error}</span> : null}
    </label>
  );
}

/**
 * Horizontal checkbox row — checkbox followed by its label text, laid out as
 * a flex row (never the base `label { grid }`, which stacks the box above the
 * text and stretches it). Extra input props pass through to the checkbox.
 */
export function CheckboxField({
  label,
  className,
  ...inputProps
}: {
  label: ReactNode;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className" | "children">) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 text-sm font-normal",
        inputProps.disabled && "cursor-not-allowed text-text-muted",
        className,
      )}
    >
      <input type="checkbox" {...inputProps} />
      <span>{label}</span>
    </label>
  );
}
