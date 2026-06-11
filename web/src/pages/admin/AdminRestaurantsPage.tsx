import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { DataTable, Pagination } from "../../components/admin/DataTable";
import type { AdminRestaurantRow } from "../../types";

const PAGE_SIZE = 25;

function fmtNum(n: number | null, digits = 1) {
  if (n == null) return "—";
  return Number(n).toFixed(digits);
}

export function AdminRestaurantsPage() {
  const { idToken } = useAuth();
  const [rows, setRows] = useState<AdminRestaurantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    setLoading(true);
    api
      .adminRestaurants(idToken, { q: search || undefined, limit: PAGE_SIZE, offset })
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
  }, [idToken, offset, search]);

  return (
    <div className="admin-page stack">
      <header className="admin-page__header">
        <div>
          <h1>Restaurants</h1>
          <p className="muted">All pilot venues with contribution stats</p>
        </div>
        <form
          className="admin-search"
          onSubmit={(e) => {
            e.preventDefault();
            setOffset(0);
            setSearch(query.trim());
          }}
        >
          <input
            className="search"
            placeholder="Search name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
      </header>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          <DataTable
            columns={[
              { key: "name", label: "Restaurant" },
              { key: "ttf", label: "Speed n", align: "right" },
              { key: "median", label: "Median", align: "right" },
              { key: "quality", label: "Quality", align: "right" },
              { key: "attr", label: "Attrs", align: "right" },
              { key: "notes", label: "Notes", align: "right" },
            ]}
            rows={rows.map((r) => ({
              key: r.id,
              cells: {
                name: (
                  <div>
                    <Link to={`/restaurants/${r.id}`} className="admin-link">
                      {r.name}
                    </Link>
                    <div className="muted small">{r.address}</div>
                    {r.cuisine_tags.length > 0 && (
                      <div className="muted small">{r.cuisine_tags.join(" · ")}</div>
                    )}
                  </div>
                ),
                ttf: r.ttf_sample_size,
                median: r.ttf_median_minutes != null ? `${fmtNum(r.ttf_median_minutes, 0)}m` : "—",
                quality: fmtNum(r.ttf_avg_quality),
                attr: r.attribute_rating_count,
                notes: r.note_count,
              },
            }))}
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
