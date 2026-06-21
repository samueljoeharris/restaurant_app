import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function ChoiceChip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "cursor-pointer rounded-md border-2 border-border bg-surface px-3 py-3 text-center text-sm font-semibold text-text transition-[border-color,background,box-shadow,transform] duration-fast hover:border-brand/45 active:scale-[0.98] min-h-11",
        selected && "border-brand bg-brand-soft shadow-[0_0_0_1px_var(--color-brand)]",
        className,
      )}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ChoiceChipGroup({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      role="group"
    >
      {children}
    </div>
  );
}
