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
    <div className="recency-chart">
      {stale && (
        <p className="recency-chart__stale" role="status">
          No parent contributions in the last 6 months — ratings may be outdated.
        </p>
      )}
      <ul className="recency-chart__rows" aria-label="Community activity by recency">
        {rows.map((row) => {
          const barPercent = (row.count / maxCount) * 100;
          return (
            <li key={row.key} className="recency-chart__row">
              <span className="recency-chart__label">{row.label}</span>
              <div
                className="recency-chart__bar-track"
                role="img"
                aria-label={`${row.label}: ${parentContributionLabel(row.count)}`}
              >
                <div
                  className="recency-chart__bar-fill"
                  style={{ width: `${barPercent}%` }}
                />
              </div>
              <span className="recency-chart__count" aria-hidden="true">
                {row.count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
