import { Badge } from "./ui/Badge";
import type { AttributeEntry } from "../types";

const CATEGORY_LABELS: Record<string, string> = {
  access: "Access",
  atmosphere: "Atmosphere",
  kids_menu: "Kids menu",
  service: "Service",
  safety: "Safety",
};

function formatValue(entry: AttributeEntry): string {
  if (entry.aggregate && entry.aggregate.value !== null && entry.aggregate.value !== undefined) {
    const { value } = entry.aggregate;
    if (entry.metric_type === "boolean") {
      return value ? "Yes" : "No";
    }
    if (entry.metric_type === "numeric") {
      return `${value} / 5`;
    }
    if (entry.metric_type === "enum") {
      return String(value).replace(/_/g, " ");
    }
    return String(value);
  }

  if (entry.sample_size > 0) {
    const remaining = Math.max(0, entry.min_sample_size - entry.sample_size);
    return remaining > 0
      ? `${entry.sample_size} rating${entry.sample_size === 1 ? "" : "s"} — need ${remaining} more`
      : "—";
  }

  return entry.message ?? "—";
}

function groupByCategory(entries: AttributeEntry[]): Map<string, AttributeEntry[]> {
  const groups = new Map<string, AttributeEntry[]>();
  for (const entry of entries) {
    const cat = entry.category;
    const list = groups.get(cat) ?? [];
    list.push(entry);
    groups.set(cat, list);
  }
  return groups;
}

function sampleBadge(entry: AttributeEntry) {
  if (entry.status === "early") {
    return (
      <Badge tone="brand">
        early · {entry.sample_size}/{entry.min_sample_size}
      </Badge>
    );
  }
  return <Badge tone="neutral">{entry.sample_size}</Badge>;
}

export function AttributeSummary({ entries }: { entries: AttributeEntry[] }) {
  const rated = entries.filter((e) => e.sample_size > 0);
  const displayable = rated.filter((e) => e.status === "ok" || e.status === "early");
  const unratedCount = entries.filter((e) => e.sample_size === 0).length;

  if (rated.length === 0) {
    return <p className="muted small">No parent ratings yet — be the first to rate this spot.</p>;
  }

  const groups = groupByCategory(displayable.length > 0 ? displayable : rated);

  return (
    <div className="attr-groups">
      {[...groups.entries()].map(([category, items]) => (
        <div key={category}>
          <h3 className="attr-cat">{CATEGORY_LABELS[category] ?? category}</h3>
          <ul className="attr-list">
            {items.map((entry) => (
              <li
                key={entry.key}
                className={entry.status === "early" ? "attr-list__item--early" : undefined}
              >
                <span>{entry.label}</span>
                <span className="attr-list__value">{formatValue(entry)}</span>
                {sampleBadge(entry)}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {displayable.some((e) => e.status === "early") && (
        <p className="field-hint">
          Early signals show after the first parent rates — full confidence at 3+ ratings per
          attribute.
        </p>
      )}
      {unratedCount > 0 && rated.length > 0 && (
        <p className="muted small">
          {unratedCount} more attribute{unratedCount === 1 ? "" : "s"} still need a first rating.
        </p>
      )}
    </div>
  );
}
