import type { ReactNode } from "react";

export function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div className={["ui-stat", highlight ? "ui-stat--highlight" : ""].join(" ")}>
      <span className="ui-stat__label">{label}</span>
      <strong className="ui-stat__value">{value}</strong>
      {hint && <span className="ui-stat__hint">{hint}</span>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="ui-stat-grid">{children}</div>;
}
