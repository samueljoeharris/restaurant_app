import { Link } from "react-router-dom";

import { cn } from "../../lib/cn";

export function AttentionCard({
  label,
  count,
  to,
  variant = "default",
}: {
  label: string;
  count: number;
  to: string;
  variant?: "default" | "warning" | "success";
}) {
  const tone =
    variant === "warning"
      ? "border-warning/30 bg-warning-soft"
      : variant === "success"
        ? "border-success/30 bg-success-soft"
        : "border-border bg-surface";

  return (
    <Link
      to={to}
      className={cn(
        "block rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md",
        tone,
      )}
    >
      <p className="m-0 text-sm text-text-muted">{label}</p>
      <p className="m-0 mt-1 text-3xl font-extrabold text-brand">{count}</p>
    </Link>
  );
}
