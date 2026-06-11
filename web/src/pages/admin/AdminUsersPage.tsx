import { useEffect, useState } from "react";

import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { DataTable, Pagination } from "../../components/admin/DataTable";
import type { AdminContributorRow } from "../../types";

const PAGE_SIZE = 25;

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminUsersPage() {
  const { idToken } = useAuth();
  const [rows, setRows] = useState<AdminContributorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    setLoading(true);
    api
      .adminUsers(idToken, PAGE_SIZE, offset)
      .then((data) => {
        if (!cancelled) {
          setRows(data.items);
          setTotal(data.total);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idToken, offset]);

  return (
    <div className="admin-page stack">
      <header className="admin-page__header">
        <div>
          <h1>Contributors</h1>
          <p className="muted">Firebase users who submitted data</p>
        </div>
      </header>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          <DataTable
            columns={[
              { key: "user", label: "User" },
              { key: "uid", label: "Firebase UID" },
              { key: "ttf", label: "Speed", align: "right" },
              { key: "attr", label: "Attrs", align: "right" },
              { key: "notes", label: "Notes", align: "right" },
              { key: "total", label: "Total", align: "right" },
              { key: "last", label: "Last active" },
            ]}
            rows={rows.map((r) => ({
              key: r.firebase_uid,
              cells: {
                user: (
                  <div>
                    <strong>{r.display_name ?? r.email ?? "Unknown"}</strong>
                    {r.disabled && <span className="admin-badge admin-badge--warn"> disabled</span>}
                    {r.email && r.display_name && (
                      <div className="muted small">{r.email}</div>
                    )}
                  </div>
                ),
                uid: <code className="admin-code">{r.firebase_uid.slice(0, 12)}…</code>,
                ttf: r.ttf_count,
                attr: r.attribute_count,
                notes: r.note_count,
                total: r.total_contributions,
                last: fmtDate(r.last_active_at),
              },
            }))}
            emptyMessage="No contributors yet — submissions will appear here."
          />
          <Pagination
            total={total}
            limit={PAGE_SIZE}
            offset={offset}
            onChange={setOffset}
          />
        </>
      )}
    </div>
  );
}
