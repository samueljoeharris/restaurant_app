import type { MetricDefinition } from "../types";
import { cn } from "../lib/cn";
import { ChoiceChip, ChoiceChipGroup } from "./ui/ChoiceChip";

type Value = boolean | number | string | undefined;

function formatEnumLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export function AttributeInput({
  metric,
  value,
  onChange,
}: {
  metric: MetricDefinition;
  value: Value;
  onChange: (value: boolean | number | string) => void;
}) {
  if (metric.input_widget === "toggle") {
    return (
      <ChoiceChipGroup columns={2}>
        <ChoiceChip selected={value === true} onClick={() => onChange(true)}>
          Yes
        </ChoiceChip>
        <ChoiceChip selected={value === false} onClick={() => onChange(false)}>
          No
        </ChoiceChip>
      </ChoiceChipGroup>
    );
  }

  if (metric.input_widget === "enum_select" && metric.enum_values) {
    const selected = typeof value === "string" ? value : null;
    return (
      <ChoiceChipGroup columns={2}>
        {metric.enum_values.map((opt) => (
          <ChoiceChip
            key={opt}
            selected={selected === opt}
            onClick={() => onChange(opt)}
          >
            {formatEnumLabel(opt)}
          </ChoiceChip>
        ))}
      </ChoiceChipGroup>
    );
  }

  const min = metric.min_value ?? 1;
  const max = metric.max_value ?? 5;
  const unset = typeof value !== "number";
  const num = typeof value === "number" ? value : min;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border bg-bg px-3 py-2 transition-[border-color,background] duration-fast",
        unset ? "border-border" : "border-brand bg-brand-soft",
      )}
    >
      <input
        type="range"
        className="flex-1 border-0 bg-transparent p-0 accent-brand focus:shadow-none"
        min={min}
        max={max}
        value={num}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={num}
        aria-label={metric.label}
      />
      <span
        className={cn(
          "min-w-[4.5rem] text-right font-bold",
          unset ? "font-medium text-text-muted" : "text-brand",
        )}
      >
        {unset ? "Tap slider" : num}
      </span>
    </div>
  );
}
