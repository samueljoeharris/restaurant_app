import { useEffect, useState, startTransition } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { DataTable, Pagination } from "../../components/admin/DataTable";
import { DetailDrawer } from "../../components/admin/DetailDrawer";
import { FilterBar, FilterField } from "../../components/admin/FilterBar";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../components/ui/useToast";
import type { AdminRestaurantDetail, AdminRestaurantRow } from "../../types";

const PAGE_SIZE = 25;

export function AdminRestaurantsPage() {
  const { idToken } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<AdminRestaurantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("open"));
  const [detail, setDetail] = useState<AdminRestaurantDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");
  const [form, setForm] = useState({ name: "", address: "", status: "active" as AdminRestaurantRow["status"] });

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    startTransition(() => setLoading(true));
    api
      .adminRestaurants(idToken, { q: search || undefined, status: status || undefined, limit: PAGE_SIZE, offset })
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
  }, [idToken, offset, search, status]);

  useEffect(() => {
    if (!idToken || !selectedId) return;
    api
      .adminRestaurantDetail(idToken, selectedId)
      .then((d) => {
        setDetail(d);
        setForm({ name: d.name, address: d.address, status: d.status });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Detail load failed"));
  }, [idToken, selectedId]);

  async function saveDetail() {
    if (!idToken || !selectedId) return;
    setSaving(true);
    try {
      const updated = await api.adminUpdateRestaurant(idToken, selectedId, form);
      setDetail(updated);
      setRows((prev) => prev.map((r) => (r.id === selectedId ? { ...r, ...updated, ttf_sample_size: updated.ttf_sample_size } : r)));
      setError(null);
      toast("Restaurant updated", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function mergeIntoTarget() {
    if (!idToken || !selectedId || !mergeTarget.trim()) return;
    setSaving(true);
    try {
      await api.adminMergeRestaurants(idToken, {
        source_id: selectedId,
        target_id: mergeTarget.trim(),
        reason: "Admin merge duplicate",
      });
      setRows((prev) => prev.filter((r) => r.id !== selectedId));
      setTotal((t) => Math.max(0, t - 1));
      setSelectedId(null);
      setDetail(null);
      setMergeTarget("");
      setError(null);
      toast("Restaurants merged", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Merge failed";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  const drawerFooter = (
    <div className="grid gap-2">
      <Button type="button" disabled={saving} onClick={() => void saveDetail()}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
      <div className="grid gap-2 rounded-md border border-border p-3">
        <p className="m-0 text-sm font-semibold">Merge duplicate into</p>
        <input
          placeholder="Target restaurant UUID"
          value={mergeTarget}
          onChange={(e) => setMergeTarget(e.target.value)}
        />
        <Button type="button" variant="danger" disabled={saving} onClick={() => void mergeIntoTarget()}>
          Merge & tombstone source
        </Button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Restaurants</h1>
          <p className="text-text-muted">Edit venues, fix data, merge duplicates</p>
        </div>
        <form
          className="min-w-[min(100%,16rem)]"
          onSubmit={(e) => {
            e.preventDefault();
            setOffset(0);
            setSearch(query.trim());
          }}
        >
          <input placeholder="Search name…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </form>
      </header>

      <FilterBar>
        <FilterField label="Status">
          <select value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value); }}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="tombstoned">Tombstoned</option>
          </select>
        </FilterField>
      </FilterBar>

      {loading && <p className="text-text-muted">Loading…</p>}
      {error && <p className="text-sm font-semibold text-error">{error}</p>}

      {!loading && !error && (
        <>
          <DataTable
            columns={[
              { key: "name", label: "Restaurant" },
              { key: "status", label: "Status" },
              { key: "ttf", label: "Speed", align: "right" },
              { key: "pending", label: "Pending" },
              { key: "notes", label: "Notes", align: "right" },
            ]}
            rows={rows.map((r) => ({
              key: r.id,
              cells: {
                name: (
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0 text-left font-semibold text-brand hover:underline"
                    onClick={() => setSelectedId(r.id)}
                  >
                    {r.name}
                  </button>
                ),
                status: <StatusBadge kind="restaurant" value={r.status} />,
                ttf: r.ttf_sample_size > 0 ? `${r.ttf_median_minutes?.toFixed(0) ?? "—"} min (${r.ttf_sample_size})` : "—",
                pending: r.pending_moderation_count ? (
                  <Badge variant="warning">{r.pending_moderation_count}</Badge>
                ) : (
                  "—"
                ),
                notes: r.note_count,
              },
            }))}
          />
          <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}

      <DetailDrawer
        open={Boolean(selectedId && detail)}
        title={detail?.name ?? "Restaurant"}
        onClose={() => {
          setSelectedId(null);
          setDetail(null);
        }}
        footer={drawerFooter}
      >
        {detail ? (
          <div className="grid gap-4">
            <label className="grid gap-1 text-sm">
              Name
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label className="grid gap-1 text-sm">
              Address
              <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </label>
            <label className="grid gap-1 text-sm">
              Status
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AdminRestaurantRow["status"] }))}
              >
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="outside_area">Outside area</option>
                <option value="tombstoned">Tombstoned</option>
              </select>
            </label>
            <div className="rounded-md border border-border bg-bg p-3 text-sm">
              <p className="m-0">Median speed: {detail.ttf_median_minutes ?? "—"} min ({detail.ttf_sample_size} samples)</p>
              <p className="m-0 mt-1 text-text-muted">{detail.note_count} notes · {detail.pending_moderation_count} pending moderation</p>
            </div>
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
