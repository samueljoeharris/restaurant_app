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
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <span
        className={cn(
          "text-xl font-extrabold tracking-tight",
          highlight && "text-brand",
        )}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-3">{children}</div>;
}
