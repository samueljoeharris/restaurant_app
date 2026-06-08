import type { MetricDefinition } from "../types";
import { Button } from "./ui/Button";

type Value = boolean | number | string | undefined;

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
      <div className="attr-input-toggle">
        <Button
          type="button"
          variant={value === true ? "primary" : "secondary"}
          size="sm"
          onClick={() => onChange(true)}
        >
          Yes
        </Button>
        <Button
          type="button"
          variant={value === false ? "primary" : "secondary"}
          size="sm"
          onClick={() => onChange(false)}
        >
          No
        </Button>
      </div>
    );
  }

  if (metric.input_widget === "enum_select" && metric.enum_values) {
    return (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Select…
        </option>
        {metric.enum_values.map((opt) => (
          <option key={opt} value={opt}>
            {opt.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    );
  }

  const min = metric.min_value ?? 1;
  const max = metric.max_value ?? 5;
  const num = typeof value === "number" ? value : min;

  return (
    <div className="slider-row">
      <input
        type="range"
        min={min}
        max={max}
        value={num}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="slider-row__value">{num}</span>
    </div>
  );
}
