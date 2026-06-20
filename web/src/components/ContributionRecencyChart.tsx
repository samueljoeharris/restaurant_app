import {
  isStaleContributionRecency,
  parentContributionLabel,
  recencyBucketRows,
} from "../lib/contributionRecency";
import type { ContributionRecency } from "../types";

export function ContributionRecencyChart({ recency }: { recency: ContributionRecency }) {
  if (recency.total === 0) return null;

  const rows = recencyBucketRows(recency);
  const maxCount = Math.max(1, ...rows.map((row) => row.count));
  const stale = isStaleContributionRecency(recency);

  return (
    <div className="flex flex-col gap-3">
      {stale && (
        <p className="m-0 rounded-md bg-bg p-3 text-sm text-text-muted" role="status">
          No parent contributions in the last 6 months — ratings may be outdated.
        </p>
      )}
      <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Community activity by recency">
        {rows.map((row) => {
          const barPercent = (row.count / maxCount) * 100;
          return (
            <li key={row.key} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2">
              <span className="text-sm text-text-muted">{row.label}</span>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-bg"
                role="img"
                aria-label={`${row.label}: ${parentContributionLabel(row.count)}`}
              >
                <div
                  className="h-full min-w-0 rounded-full bg-brand transition-[width] duration-200 ease-out"
                  style={{ width: `${barPercent}%` }}
                />
              </div>
              <span className="text-right text-sm tabular-nums text-text" aria-hidden="true">
                {row.count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
