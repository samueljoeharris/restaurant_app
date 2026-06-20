import { Badge } from "../ui/Badge";

const TRUST_LABELS: Record<string, string> = {
  new: "New",
  standard: "Standard",
  trusted: "Trusted",
  restricted: "Restricted",
};

export function StatusBadge({
  kind,
  value,
}: {
  kind: "trust" | "moderation" | "restaurant";
  value: string;
}) {
  if (kind === "trust") {
    const variant =
      value === "trusted" ? "success" : value === "restricted" ? "warning" : "neutral";
    return <Badge variant={variant}>{TRUST_LABELS[value] ?? value}</Badge>;
  }
  if (kind === "moderation") {
    const variant =
      value === "pending" || value === "escalated"
        ? "warning"
        : value === "approved"
          ? "success"
          : "neutral";
    return <Badge variant={variant}>{value}</Badge>;
  }
  return <Badge variant={value === "active" ? "success" : "neutral"}>{value}</Badge>;
}
