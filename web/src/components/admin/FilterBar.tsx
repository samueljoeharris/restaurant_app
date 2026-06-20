import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function FilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4", className)}>
      {children}
    </div>
  );
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}
