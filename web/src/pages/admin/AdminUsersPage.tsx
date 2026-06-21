import { useEffect, useState, startTransition } from "react";
import { useSearchParams } from "react-router-dom";

import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { DataTable, Pagination } from "../../components/admin/DataTable";
import { DetailDrawer } from "../../components/admin/DetailDrawer";
import { FilterBar, FilterField } from "../../components/admin/FilterBar";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/Button";
import { useToast } from "../../components/ui/useToast";
import { applyContributorMutation, removeContributorFromList } from "../../lib/adminContributorSync";
import {
  CONTRIBUTOR_TRUST_TIERS,
  contributorTrustDescription,
  contributorTrustSuccessMessage,
} from "../../lib/contributorTrust";
import type { AdminContributorDetail, AdminContributorRow } from "../../types";

const PAGE_SIZE = 25;

function actionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return err.message;
    if (err.status === 502) {
      return `${err.message} Postgres may already be updated — refresh and check logs.`;
    }
    if (err.status >= 500) return `${err.message} If this persists, check Cloud Run logs.`;
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

function disableSuccessMessage(detail: AdminContributorDetail): string {
  if (!detail.auth_account_exists) {
    return "Contributor restricted in Postgres (no Firebase Auth account)";
  }
  return "Account disabled";
}

function enableSuccessMessage(detail: AdminContributorDetail): string {
  if (!detail.auth_account_exists) {
    return "Contributor trust restored in Postgres (no Firebase Auth account)";
  }
  return "Account enabled";
}

export function AdminUsersPage() {
  const { idToken, user } = useAuth();
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

  const isSelf = Boolean(user?.uid && selectedUid && user.uid === selectedUid);

  function applyContributorUpdate(refreshed: AdminContributorDetail, successMessage: string) {
    setDetail(refreshed);
    setError(null);
    const synced = applyContributorMutation(rows, total, refreshed, trustFilter);
    setRows(synced.rows);
    setTotal(synced.total);
    toast(successMessage, "success");
  }

  async function updateTrustLevel(trustLevel: string) {
    if (!idToken || !selectedUid) return;
    setBusy(true);
    try {
      const refreshed = await api.adminUpdateUserTrust(idToken, selectedUid, { trust_level: trustLevel });
      applyContributorUpdate(refreshed, contributorTrustSuccessMessage(trustLevel));
    } catch (err) {
      const message = actionErrorMessage(err, "Update failed");
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
      applyContributorUpdate(
        refreshed,
        disable ? disableSuccessMessage(refreshed) : enableSuccessMessage(refreshed),
      );
    } catch (err) {
      const message = actionErrorMessage(err, "Action failed");
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!idToken || !selectedUid || isSelf) return;
    const label = detail?.display_name ?? detail?.email ?? selectedUid;
    const confirmed = window.confirm(
      `Permanently delete "${label}"?\n\nThis removes their Firebase account (if present), all contributions, photos, watches, and profile data. This cannot be undone.`,
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await api.adminDeleteUserAccount(idToken, selectedUid);
      const synced = removeContributorFromList(rows, total, selectedUid);
      setRows(synced.rows);
      setTotal(synced.total);
      setSelectedUid(null);
      setDetail(null);
      setError(null);
      toast("Account and contributions deleted", "success");
    } catch (err) {
      const message = actionErrorMessage(err, "Delete failed");
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
        <p className="text-text-muted">Trust tier controls moderation queue vs immediate publish</p>
      </header>

      <FilterBar>
        <FilterField label="Trust tier">
          <select value={trustFilter} onChange={(e) => { setOffset(0); setTrustFilter(e.target.value); }}>
            <option value="">All</option>
            {CONTRIBUTOR_TRUST_TIERS.map((tier) => (
              <option key={tier.value} value={tier.value}>{tier.shortLabel}</option>
            ))}
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
              {isSelf ? (
                <p className="m-0 text-sm text-text-muted">
                  You cannot disable or delete your own account from this screen.
                </p>
              ) : (
                <>
                  {detail.disabled ? (
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void toggleDisabled(false)}>
                      Enable account
                    </Button>
                  ) : (
                    <Button type="button" variant="danger" disabled={busy} onClick={() => void toggleDisabled(true)}>
                      Disable account
                    </Button>
                  )}
                  <Button type="button" variant="danger" disabled={busy} onClick={() => void deleteAccount()}>
                    Delete account
                  </Button>
                </>
              )}
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="grid gap-4 text-sm">
            <p className="m-0 text-text-muted">{detail.firebase_uid}</p>
            {!detail.auth_account_exists ? (
              <p className="m-0 text-sm font-semibold text-warning">
                No Firebase Auth account — contributions remain in Postgres. Use Delete account to remove data.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <StatusBadge kind="trust" value={detail.trust_level} />
            </div>
            <label className="grid gap-1">
              Trust tier
              <select
                value={detail.trust_level}
                disabled={busy}
                onChange={(e) => void updateTrustLevel(e.target.value)}
              >
                {CONTRIBUTOR_TRUST_TIERS.map((tier) => (
                  <option key={tier.value} value={tier.value}>{tier.label}</option>
                ))}
              </select>
            </label>
            {contributorTrustDescription(detail.trust_level) ? (
              <p className="m-0 text-text-muted">{contributorTrustDescription(detail.trust_level)}</p>
            ) : null}
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
