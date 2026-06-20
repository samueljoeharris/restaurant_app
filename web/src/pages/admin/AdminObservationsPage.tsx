import { useEffect, useState, startTransition } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { DataTable, Pagination } from "../../components/admin/DataTable";
import { FilterBar, FilterField } from "../../components/admin/FilterBar";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/cn";
import type { AdminObservationRow } from "../../types";

const PAGE_SIZE = 30;
const EXCLUDE_REASONS = ["mistaken_entry", "duplicate", "implausible", "other"];

export function AdminObservationsPage() {
  const { idToken } = useAuth();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<AdminObservationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [uid, setUid] = useState("");
  const [daypart, setDaypart] = useState("");
  const [excluded, setExcluded] = useState<string>(searchParams.get("excluded") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    if (!idToken) return;
    startTransition(() => setLoading(true));
    api
      .adminObservations(idToken, {
        limit: PAGE_SIZE,
        offset,
        firebase_uid: uid || undefined,
        daypart: daypart || undefined,
        excluded: excluded === "" ? undefined : excluded === "true",
      })
      .then((data) => {
        setRows(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, [idToken, offset, uid, daypart, excluded]);

  async function exclude(id: string, reason: string) {
    if (!idToken) return;
    setBusyId(id);
    try {
      await api.adminExcludeObservation(idToken, id, reason);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Exclude failed");
    } finally {
      setBusyId(null);
    }
  }

  async function restore(id: string) {
    if (!idToken) return;
    setBusyId(id);
    try {
      await api.adminRestoreObservation(idToken, id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl">Data & observations</h1>
        <p className="text-text-muted">Protect venue medians — flag outliers and exclude bad inputs</p>
      </header>

      <FilterBar>
        <FilterField label="User UID">
          <input value={uid} onChange={(e) => { setOffset(0); setUid(e.target.value); }} placeholder="firebase uid" />
        </FilterField>
        <FilterField label="Daypart">
          <select value={daypart} onChange={(e) => { setOffset(0); setDaypart(e.target.value); }}>
            <option value="">All</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="late">Late</option>
          </select>
        </FilterField>
        <FilterField label="Excluded">
          <select value={excluded} onChange={(e) => { setOffset(0); setExcluded(e.target.value); }}>
            <option value="">All</option>
            <option value="false">In median</option>
            <option value="true">Excluded</option>
          </select>
        </FilterField>
      </FilterBar>

      {loading && <p className="text-text-muted">Loading…</p>}
      {error && <p className="text-sm font-semibold text-error">{error}</p>}

      {!loading && !error && (
        <>
          <DataTable
            columns={[
              { key: "when", label: "When" },
              { key: "restaurant", label: "Restaurant" },
              { key: "ttf", label: "Speed", align: "right" },
              { key: "median", label: "Venue median", align: "right" },
              { key: "uid", label: "User" },
              { key: "actions", label: "Actions" },
            ]}
            rows={rows.map((r) => ({
              key: r.id,
              cells: {
                when: new Date(r.created_at).toLocaleString(),
                restaurant: r.restaurant_name,
                ttf: (
                  <span className={cn(r.excluded_from_aggregate && "text-error line-through")}>
                    {r.elapsed_minutes} min
                  </span>
                ),
                median: r.restaurant_median_minutes != null ? `${r.restaurant_median_minutes.toFixed(0)} min` : "—",
                uid: r.firebase_uid.slice(0, 10) + "…",
                actions: r.excluded_from_aggregate ? (
                  <Button type="button" size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => void restore(r.id)}>
                    Restore
                  </Button>
                ) : (
                  <select
                    className="max-w-[10rem] text-sm"
                    defaultValue=""
                    disabled={busyId === r.id}
                    onChange={(e) => {
                      if (e.target.value) void exclude(r.id, e.target.value);
                      e.target.value = "";
                    }}
                  >
                    <option value="">Exclude…</option>
                    {EXCLUDE_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                ),
              },
            }))}
          />
          <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  );
}
