import { useEffect, useState, startTransition } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { DataTable, Pagination } from "../../components/admin/DataTable";
import { DetailDrawer } from "../../components/admin/DetailDrawer";
import { FilterBar, FilterField } from "../../components/admin/FilterBar";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/useToast";
import { applyContributorMutation } from "../../lib/adminContributorSync";
import type { AdminContributorDetail, AdminContributorRow } from "../../types";

const PAGE_SIZE = 25;

export function AdminUsersPage() {
  const { idToken } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<AdminContributorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [trustFilter, setTrustFilter] = useState(searchParams.get("trust") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUid, setSelectedUid] = useState<string | null>(searchParams.get("uid"));
  const [detail, setDetail] = useState<AdminContributorDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    startTransition(() => setLoading(true));
    api
      .adminUsers(idToken, {
        limit: PAGE_SIZE,
        offset,
        trust_level: trustFilter || undefined,
      })
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
  }, [idToken, offset, trustFilter]);

  useEffect(() => {
    if (!idToken || !selectedUid) return;
    api
      .adminUserDetail(idToken, selectedUid)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "Profile load failed"));
  }, [idToken, selectedUid]);

  function applyContributorUpdate(refreshed: AdminContributorDetail, successMessage: string) {
    setDetail(refreshed);
    setError(null);
    const synced = applyContributorMutation(rows, total, refreshed, trustFilter);
    setRows(synced.rows);
    setTotal(synced.total);
    toast(successMessage, "success");
  }

  async function updateTrust(
    patch: { trust_level?: string; auto_publish?: boolean },
    successMessage = "Contributor updated",
  ) {
    if (!idToken || !selectedUid) return;
    setBusy(true);
    try {
      const refreshed = await api.adminUpdateUserTrust(idToken, selectedUid, patch);
      const message =
        patch.trust_level === "trusted" && patch.auto_publish
          ? "Promoted to trusted"
          : patch.trust_level
            ? `Trust level set to ${patch.trust_level}`
            : patch.auto_publish != null
              ? patch.auto_publish
                ? "Auto-publish enabled"
                : "Auto-publish disabled"
              : successMessage;
      applyContributorUpdate(refreshed, message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDisabled(disable: boolean) {
    if (!idToken || !selectedUid) return;
    setBusy(true);
    try {
      const refreshed = disable
        ? await api.adminDisableUser(idToken, selectedUid)
        : await api.adminEnableUser(idToken, selectedUid);
      applyContributorUpdate(refreshed, disable ? "Account disabled" : "Account enabled");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl">Contributors</h1>
        <p className="text-text-muted">Trust levels, auto-publish, and account actions</p>
      </header>

      <FilterBar>
        <FilterField label="Trust level">
          <select value={trustFilter} onChange={(e) => { setOffset(0); setTrustFilter(e.target.value); }}>
            <option value="">All</option>
            <option value="new">New</option>
            <option value="standard">Standard</option>
            <option value="trusted">Trusted</option>
            <option value="restricted">Restricted</option>
          </select>
        </FilterField>
      </FilterBar>

      {loading && <p className="text-text-muted">Loading…</p>}
      {error && <p className="text-sm font-semibold text-error">{error}</p>}

      {!loading && !error && (
        <>
          <DataTable
            columns={[
              { key: "user", label: "User" },
              { key: "trust", label: "Trust" },
              { key: "ttf", label: "Speed", align: "right" },
              { key: "notes", label: "Notes", align: "right" },
              { key: "total", label: "Total", align: "right" },
              { key: "last", label: "Last active" },
            ]}
            rows={rows.map((r) => ({
              key: r.firebase_uid,
              cells: {
                user: (
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0 text-left"
                    onClick={() => setSelectedUid(r.firebase_uid)}
                  >
                    <strong>{r.display_name ?? r.email ?? "Unknown"}</strong>
                    {r.disabled ? <span className="ml-2 text-xs text-error">disabled</span> : null}
                  </button>
                ),
                trust: r.trust_level ? <StatusBadge kind="trust" value={r.trust_level} /> : "—",
                ttf: r.ttf_count,
                notes: r.note_count,
                total: r.total_contributions,
                last: r.last_active_at ? new Date(r.last_active_at).toLocaleString() : "—",
              },
            }))}
          />
          <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />
        </>
      )}

      <DetailDrawer
        open={Boolean(selectedUid && detail)}
        title={detail?.display_name ?? detail?.email ?? "Contributor"}
        onClose={() => {
          setSelectedUid(null);
          setDetail(null);
        }}
        footer={
          detail ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void updateTrust({ trust_level: "trusted", auto_publish: true }, "Promoted to trusted")}
              >
                Promote to trusted
              </Button>
              {detail.disabled ? (
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void toggleDisabled(false)}>
                  Enable account
                </Button>
              ) : (
                <Button type="button" variant="danger" disabled={busy} onClick={() => void toggleDisabled(true)}>
                  Disable account
                </Button>
              )}
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="grid gap-4 text-sm">
            <p className="m-0 text-text-muted">{detail.firebase_uid}</p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge kind="trust" value={detail.trust_level} />
              {detail.auto_publish ? <StatusBadge kind="moderation" value="approved" /> : null}
            </div>
            <label className="grid gap-1">
              Trust level
              <select
                value={detail.trust_level}
                disabled={busy}
                onChange={(e) => void updateTrust({ trust_level: e.target.value })}
              >
                <option value="new">New</option>
                <option value="standard">Standard</option>
                <option value="trusted">Trusted</option>
                <option value="restricted">Restricted</option>
              </select>
            </label>
              <label className="field-row flex items-center gap-2">
              <input
                type="checkbox"
                checked={detail.auto_publish}
                disabled={busy}
                onChange={(e) => void updateTrust({ auto_publish: e.target.checked })}
              />
              Auto-publish submissions
            </label>
            <div className="rounded-md border border-border bg-bg p-3">
              <p className="m-0">{detail.ttf_count} speed · {detail.attribute_count} attrs · {detail.note_count} notes</p>
              <p className="m-0 mt-1 text-text-muted">{detail.watch_count} watched restaurants</p>
            </div>
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
