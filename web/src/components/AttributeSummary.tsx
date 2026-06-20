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
      <Badge variant="brand">
        early · {entry.sample_size}/{entry.min_sample_size}
      </Badge>
    );
  }
  return <Badge variant="neutral">{entry.sample_size}</Badge>;
}

export function AttributeSummary({ entries }: { entries: AttributeEntry[] }) {
  const rated = entries.filter((e) => e.sample_size > 0);
  const displayable = rated.filter((e) => e.status === "ok" || e.status === "early");
  const unratedCount = entries.filter((e) => e.sample_size === 0).length;

  if (rated.length === 0) {
    return <p className="text-sm text-text-muted">No parent ratings yet — be the first to rate this spot.</p>;
  }

  const groups = groupByCategory(displayable.length > 0 ? displayable : rated);

  return (
    <div className="grid gap-4">
      {[...groups.entries()].map(([category, items]) => (
        <div key={category}>
          <h3 className="mb-2 text-sm font-semibold capitalize text-text-muted">
            {CATEGORY_LABELS[category] ?? category}
          </h3>
          <ul className="m-0 grid list-none gap-2 p-0">
            {items.map((entry) => (
              <li
                key={entry.key}
                className={
                  entry.status === "early"
                    ? "-m-2 grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md bg-brand-soft p-2 text-sm"
                    : "grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm"
                }
              >
                <span>{entry.label}</span>
                <span className="font-semibold capitalize">{formatValue(entry)}</span>
                {sampleBadge(entry)}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {displayable.some((e) => e.status === "early") && (
        <p className="m-0 text-xs text-text-muted">
          Early signals show after the first parent rates — full confidence at 3+ ratings per
          attribute.
        </p>
      )}
      {unratedCount > 0 && rated.length > 0 && (
        <p className="text-sm text-text-muted">
          {unratedCount} more attribute{unratedCount === 1 ? "" : "s"} still need a first rating.
        </p>
      )}
    </div>
  );
}
