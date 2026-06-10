import type { ReactNode } from "react";

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
    return <p className="admin-empty">{emptyMessage}</p>;
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.align === "right" ? "admin-table__num" : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={col.align === "right" ? "admin-table__num" : undefined}
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
    <div className="admin-pagination">
      <span className="muted small">
        {total === 0 ? "0 rows" : `${offset + 1}–${Math.min(offset + limit, total)} of ${total}`}
      </span>
      <div className="admin-pagination__controls">
        <button type="button" disabled={offset === 0} onClick={() => onChange(prev)}>
          Previous
        </button>
        <span className="muted small">
          Page {page} / {pages}
        </span>
        <button
          type="button"
          disabled={next === null}
          onClick={() => next !== null && onChange(next)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
