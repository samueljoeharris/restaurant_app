import type { ReactNode } from "react";

import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";

export function DataTable({
  columns,
  rows,
  emptyMessage = "No rows",
}: {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: { key: string; cells: Record<string, ReactNode> }[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="px-8 py-8 text-center text-text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "border-b border-border bg-bg px-4 py-3 text-left text-xs tracking-wide text-text-muted uppercase",
                  col.align === "right" && "text-right tabular-nums",
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="hover:bg-brand-soft/50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "border-b border-border px-4 py-3 align-top last:border-b-0",
                    col.align === "right" && "text-right tabular-nums",
                  )}
                >
                  {row.cells[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  const prev = Math.max(0, offset - limit);
  const next = offset + limit < total ? offset + limit : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-text-muted">
        {total === 0 ? "0 rows" : `${offset + 1}–${Math.min(offset + limit, total)} of ${total}`}
      </span>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={offset === 0}
          onClick={() => onChange(prev)}
        >
          Previous
        </Button>
        <span className="text-sm text-text-muted">
          Page {page} / {pages}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={next === null}
          onClick={() => next !== null && onChange(next)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
