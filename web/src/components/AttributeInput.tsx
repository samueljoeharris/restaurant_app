import type { MetricDefinition } from "../types";
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
    <div className={`slider-field${unset ? " slider-field--unset" : " slider-field--set"}`}>
      <input
        type="range"
        className="slider-field__input"
        min={min}
        max={max}
        value={num}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={num}
        aria-label={metric.label}
      />
      <span className="slider-field__value">{unset ? "Tap slider" : num}</span>
    </div>
  );
}
