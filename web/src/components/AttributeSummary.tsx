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
  if (entry.status !== "ok" || !entry.aggregate) {
    return entry.message ?? "—";
  }
  const { value } = entry.aggregate;
  if (value === null || value === undefined) return "—";

  if (entry.metric_type === "boolean") {
    return value ? "Yes" : "No";
  }
  if (entry.metric_type === "numeric") {
    const max = entry.key.includes("noise") || entry.key.includes("lighting") ? 5 : 5;
    return `${value} / ${max}`;
  }
  if (entry.metric_type === "enum") {
    return String(value).replace(/_/g, " ");
  }
  return String(value);
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

export function AttributeSummary({ entries }: { entries: AttributeEntry[] }) {
  const withData = entries.filter((e) => e.status === "ok");
  const pending = entries.filter((e) => e.status !== "ok");

  if (entries.length === 0) {
    return <p className="muted small">No parent ratings yet.</p>;
  }

  const groups = groupByCategory(withData);

  return (
    <div className="attr-groups">
      {withData.length === 0 ? (
        <p className="muted small">Be the first parent to rate this spot.</p>
      ) : (
        [...groups.entries()].map(([category, items]) => (
          <div key={category}>
            <h3 className="attr-cat">{CATEGORY_LABELS[category] ?? category}</h3>
            <ul className="attr-list">
              {items.map((entry) => (
                <li key={entry.key}>
                  <span>{entry.label}</span>
                  <span className="attr-list__value">{formatValue(entry)}</span>
                  <Badge tone="neutral">{entry.sample_size}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      {pending.length > 0 && withData.length > 0 && (
        <p className="muted small">
          {pending.length} more attribute{pending.length === 1 ? "" : "s"} need more ratings.
        </p>
      )}
    </div>
  );
}
