import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

type PillTone = "brand" | "accent" | "pop";

const toneClass: Record<PillTone, string> = {
  brand: "text-brand",
  accent: "text-accent",
  pop: "text-accent-pop",
};

export function AccountStatPill({
  value,
  label,
  tone = "brand",
}: {
  value: ReactNode;
  label: string;
  tone?: PillTone;
}) {
  return (
    <div className="flex-1 rounded-2xl border border-border bg-surface px-3 py-3 text-center shadow-sm">
      <div className={cn("font-display text-2xl font-bold leading-tight tracking-tight", toneClass[tone])}>
        {value}
      </div>
      <div className="mt-1 text-[0.65625rem] font-bold leading-snug text-text-muted">{label}</div>
    </div>
  );
}
