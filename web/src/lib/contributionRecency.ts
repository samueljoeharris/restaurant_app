import type { ContributionRecency } from "../types";

export const EMPTY_CONTRIBUTION_RECENCY: ContributionRecency = {
  last_7_days: 0,
  days_8_to_30: 0,
  days_31_to_180: 0,
  over_365_days: 0,
  total: 0,
};

export interface RecencyBucketRow {
  key: keyof Omit<ContributionRecency, "total">;
  label: string;
  count: number;
}

export const RECENCY_BUCKET_ROWS: Omit<RecencyBucketRow, "count">[] = [
  { key: "last_7_days", label: "This week" },
  { key: "days_8_to_30", label: "This month" },
  { key: "days_31_to_180", label: "Past 6 mo" },
  { key: "over_365_days", label: "Over 6 mo ago" },
];

export function recencyBucketRows(recency: ContributionRecency): RecencyBucketRow[] {
  return RECENCY_BUCKET_ROWS.map((row) => ({
    ...row,
    count: recency[row.key],
  }));
}

export function isStaleContributionRecency(recency: ContributionRecency): boolean {
  if (recency.total === 0) return false;
  return (
    recency.last_7_days === 0 &&
    recency.days_8_to_30 === 0 &&
    recency.days_31_to_180 === 0
  );
}

export function parentContributionLabel(count: number): string {
  return `${count} parent contribution${count === 1 ? "" : "s"}`;
}
