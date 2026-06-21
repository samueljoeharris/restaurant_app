import { cn } from "../../lib/cn";

export function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-0.5 rounded-md p-3",
        highlight ? "bg-brand-soft" : "bg-bg",
      )}
    >
      <span className="text-[length:var(--text-label)] font-extrabold uppercase tracking-[var(--text-tracking-label)] text-text-muted">
        {label}
      </span>
      <span
        className={cn(
          "font-display font-bold leading-[var(--text-leading-tight)] tracking-tight",
          highlight ? "text-[length:var(--text-number)] text-brand" : "text-[length:var(--text-h2)]",
        )}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{children}</div>
  );
}
