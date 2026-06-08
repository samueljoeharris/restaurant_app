import type { ReactNode } from "react";

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
      className={["choice-chip", selected ? "choice-chip--active" : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
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
      className="choice-chip-group"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      role="group"
    >
      {children}
    </div>
  );
}
