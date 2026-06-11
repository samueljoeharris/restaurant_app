import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { DataTable, Pagination } from "../../components/admin/DataTable";
import type { AdminObservationRow } from "../../types";

const PAGE_SIZE = 30;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminObservationsPage() {
  const { idToken } = useAuth();
  const [rows, setRows] = useState<AdminObservationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    setLoading(true);
    api
      .adminObservations(idToken, PAGE_SIZE, offset)
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
          <h1>Observation log</h1>
          <p className="muted">Recent kid food speed submissions</p>
        </div>
      </header>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          <DataTable
            columns={[
              { key: "when", label: "When" },
              { key: "restaurant", label: "Restaurant" },
              { key: "ttf", label: "Speed", align: "right" },
              { key: "item", label: "Item" },
              { key: "quality", label: "Quality", align: "right" },
              { key: "daypart", label: "Daypart" },
              { key: "uid", label: "User" },
            ]}
            rows={rows.map((r) => ({
              key: r.id,
              cells: {
                when: fmtDate(r.created_at),
                restaurant: (
                  <Link to={`/restaurants/${r.restaurant_id}`} className="admin-link">
                    {r.restaurant_name}
                  </Link>
                ),
                ttf: `${r.elapsed_minutes}m`,
                item: r.item_type.replace("_", " "),
                quality: `${r.item_quality}/5`,
                daypart: r.daypart,
                uid: <code className="admin-code">{r.firebase_uid.slice(0, 10)}…</code>,
              },
            }))}
            emptyMessage="No observations yet."
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
