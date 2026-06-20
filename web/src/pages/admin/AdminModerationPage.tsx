import { useEffect, useState, startTransition } from "react";
import { Link } from "react-router-dom";

import { api } from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { DataTable, Pagination } from "../../components/admin/DataTable";
import { FilterBar, FilterField } from "../../components/admin/FilterBar";
import { ModerationActions } from "../../components/admin/ModerationActions";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Badge } from "../../components/ui/Badge";
import { useToast } from "../../components/ui/useToast";
import type { ModerationItemRow } from "../../types";

const PAGE_SIZE = 25;

function fmtAge(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AdminModerationPage() {
  const { idToken } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<ModerationItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("pending");
  const [contentType, setContentType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    if (!idToken) return;
    startTransition(() => setLoading(true));
    api
      .adminModeration(idToken, {
        status,
        content_type: contentType || undefined,
        limit: PAGE_SIZE,
        offset,
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
  }, [idToken, offset, status, contentType]);

  async function act(id: string, action: "approve" | "reject" | "escalate") {
    if (!idToken || busyId) return;
    setBusyId(id);
    try {
      if (action === "approve") await api.adminModerationApprove(idToken, id);
      if (action === "reject") await api.adminModerationReject(idToken, id);
      if (action === "escalate") await api.adminModerationEscalate(idToken, id);
      if (status === "all") {
        reload();
      } else {
        setRows((prev) => prev.filter((r) => r.id !== id));
        setTotal((t) => Math.max(0, t - 1));
      }
      setError(null);
      const labels = { approve: "Approved", reject: "Rejected", escalate: "Escalated" };
      toast(labels[action], "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed";
      setError(message);
      toast(message, "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl">Moderation</h1>
        <p className="text-text-muted">Review parent notes and submissions before they go live</p>
      </header>

      <FilterBar>
        <FilterField label="Status">
          <select value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value); }}>
            <option value="pending">Pending</option>
            <option value="escalated">Escalated</option>
            <option value="all">All</option>
          </select>
        </FilterField>
        <FilterField label="Type">
          <select value={contentType} onChange={(e) => { setOffset(0); setContentType(e.target.value); }}>
            <option value="">All types</option>
            <option value="note">Notes</option>
            <option value="ttf_observation">Speed</option>
            <option value="attribute_rating">Attributes</option>
          </select>
        </FilterField>
      </FilterBar>

      {loading && <p className="text-text-muted">Loading queue…</p>}
      {error && <p className="text-sm font-semibold text-error">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="rounded-lg border border-border bg-surface p-8 text-center text-text-muted">
          Nothing waiting — good shift.
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <DataTable
            columns={[
              { key: "type", label: "Type" },
              { key: "restaurant", label: "Restaurant" },
              { key: "author", label: "Author" },
              { key: "preview", label: "Preview" },
              { key: "flags", label: "Flags" },
              { key: "age", label: "Age" },
              { key: "actions", label: "Actions" },
            ]}
            rows={rows.map((r) => ({
              key: r.id,
              cells: {
                type: r.content_type.replace("_", " "),
                restaurant: r.restaurant_name ?? "—",
                author: (
                  <div className="grid gap-1">
                    <Link to={`/admin/users?uid=${r.firebase_uid}`} className="font-semibold text-brand hover:underline">
                      {r.firebase_uid.slice(0, 8)}…
                    </Link>
                    {r.author_trust_level ? (
                      <StatusBadge kind="trust" value={r.author_trust_level} />
                    ) : null}
                  </div>
                ),
                preview: r.preview_text ?? "—",
                flags: (
                  <div className="flex flex-wrap gap-1">
                    {r.flag_reasons.map((f) => (
                      <Badge key={f} variant="neutral">
                        {f.replace(/_/g, " ")}
                      </Badge>
                    ))}
                    {r.report_count > 0 ? <span className="text-xs text-error">{r.report_count} reports</span> : null}
                  </div>
                ),
                age: fmtAge(r.created_at),
                actions: (
                  <ModerationActions
                    busy={busyId === r.id}
                    onApprove={() => void act(r.id, "approve")}
                    onReject={() => void act(r.id, "reject")}
                    onEscalate={() => void act(r.id, "escalate")}
                  />
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
