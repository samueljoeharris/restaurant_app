import { useCallback, useEffect, useState, startTransition } from "react";
import type { ReactNode } from "react";

import { api } from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { DataTable, Pagination } from "../../components/admin/DataTable";
import { Button } from "../../components/ui/Button";
import { CheckboxField, FormField } from "../../components/ui/FormField";
import { useToast } from "../../components/ui/useToast";
import type {
  AdminAuditLogRow,
  GcpConsoleLinks,
  LocationRefreshConfig,
  RestaurantChangelogRow,
  RestaurantSeedJob,
} from "../../types";

const PAGE_SIZE = 20;
const METERS_PER_MILE = 1609.344;
const DEFAULT_RADIUS_MI = 5;
const MIN_RADIUS_MI = 0.6; // ~1000 m API floor
const MAX_RADIUS_MI = 15.5; // ~25000 m API cap

function milesToMeters(mi: number) {
  return Math.round(mi * METERS_PER_MILE);
}

function fmtRadiusMi(radiusM: number) {
  const mi = radiusM / METERS_PER_MILE;
  return mi >= 10 ? `${Math.round(mi)} mi` : `${mi.toFixed(1)} mi`;
}

function GcpLink({
  href,
  children,
  title,
}: {
  href: string | null | undefined;
  children: ReactNode;
  title?: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-sm whitespace-nowrap"
      title={title}
    >
      {children} ↗
    </a>
  );
}

function GcpInfraPanel({ links }: { links: GcpConsoleLinks | null | undefined }) {
  if (!links) return null;
  return (
    <section className="rounded-lg border border-border bg-surface-muted p-5 shadow-sm">
      <h2 className="mb-3 text-lg">How runs execute in GCP</h2>
      <p className="text-sm text-text-muted">
        Runs are rows in Postgres, not separate Cloud Run Jobs. Work is queued on Pub/Sub and
        executed inside the <strong>ttf-api</strong> Cloud Run service. Scheduled refresh uses
        Cloud Scheduler → API → the same queue.
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        <li><GcpLink href={links.cloud_run_url}>Cloud Run · ttf-api logs</GcpLink></li>
        <li><GcpLink href={links.pubsub_subscription_url}>Pub/Sub · ttf-restaurant-seed-worker</GcpLink></li>
        <li><GcpLink href={links.pubsub_topic_url}>Pub/Sub · ttf-restaurant-seed-jobs topic</GcpLink></li>
        <li><GcpLink href={links.scheduler_url}>Cloud Scheduler · weekly refresh</GcpLink></li>
      </ul>
    </section>
  );
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function statusClass(status: RestaurantSeedJob["status"]) {
  if (status === "succeeded") return "font-bold text-success";
  if (status === "failed") return "font-bold text-warning";
  if (status === "running" || status === "pending") return "font-bold text-brand";
  return "";
}

function actionLabel(action: RestaurantChangelogRow["action"]) {
  const labels: Record<RestaurantChangelogRow["action"], string> = {
    added: "Added",
    updated: "Updated",
    tombstoned: "Tombstoned",
    reactivated: "Reactivated",
    closed: "Closed",
    outside_area: "Outside area",
  };
  return labels[action];
}

function reasonLabel(reason: string | null, action: RestaurantChangelogRow["action"]) {
  if (!reason) {
    if (action === "added") return "New in Places search";
    if (action === "updated") return "Fields changed in Places";
    return "—";
  }
  const labels: Record<string, string> = {
    seen_in_places_sync: "Seen in Places sync",
    google_places_closed: "Google Places: closed",
    not_seen_in_places_sync: "Not seen in Places sync",
    place_no_longer_exists: "Place no longer exists",
  };
  return labels[reason] ?? reason;
}

function auditActionLabel(action: AdminAuditLogRow["action"]) {
  const labels: Record<string, string> = {
    auto_refresh_enabled: "Auto-refresh enabled",
    auto_refresh_disabled: "Auto-refresh disabled",
    updated: "Settings updated",
    enabled: "Location enabled",
    disabled: "Location disabled",
  };
  return labels[action] ?? action;
}

function auditSummary(row: AdminAuditLogRow) {
  if (row.category === "seed_location") {
    const label = (row.new_values?.label as string | undefined) ?? row.entity_id ?? "location";
    return label;
  }
  if (row.action === "auto_refresh_enabled" || row.action === "auto_refresh_disabled") {
    return row.action === "auto_refresh_enabled" ? "Scheduler resumed" : "Scheduler paused";
  }
  const sync = row.metadata?.scheduler_sync as { status?: string; detail?: string } | undefined;
  if (sync?.status === "synced") return sync.detail ?? "Scheduler synced";
  if (sync?.status === "failed") return sync.detail ?? "Scheduler sync failed";
  return "Refresh settings saved";
}

export function AdminCatalogRefreshPage() {
  const { idToken } = useAuth();
  const { toast } = useToast();
  const [runs, setRuns] = useState<RestaurantSeedJob[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsOffset, setRunsOffset] = useState(0);
  const [changelog, setChangelog] = useState<RestaurantChangelogRow[]>([]);
  const [changelogTotal, setChangelogTotal] = useState(0);
  const [changelogOffset, setChangelogOffset] = useState(0);
  const [changelogAction, setChangelogAction] = useState("");
  const [config, setConfig] = useState<LocationRefreshConfig | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AdminAuditLogRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditOffset, setAuditOffset] = useState(0);

  const [location, setLocation] = useState("");
  const [radiusMi, setRadiusMi] = useState(DEFAULT_RADIUS_MI);
  const [force, setForce] = useState(false);

  const loadAuditLog = useCallback(async (offset = auditOffset) => {
    if (!idToken) return;
    try {
      const data = await api.adminAuditLog(idToken, {
        limit: PAGE_SIZE,
        offset,
      });
      setAuditLog(data.items);
      setAuditTotal(data.total);
    } catch {
      // Non-blocking — main page data still loads.
    }
  }, [idToken, auditOffset]);

  const loadRuns = useCallback(async (offset = runsOffset) => {
    if (!idToken) return;
    setRunsLoading(true);
    try {
      const data = await api.adminSeedJobs(idToken, PAGE_SIZE, offset);
      setRuns(data.items);
      setRunsTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load runs failed");
    } finally {
      setRunsLoading(false);
    }
  }, [idToken, runsOffset]);

  const loadChangelog = useCallback(async (offset = changelogOffset) => {
    if (!idToken) return;
    setChangelogLoading(true);
    try {
      const data = await api.adminRestaurantChangelog(idToken, {
        limit: PAGE_SIZE,
        offset,
        action: changelogAction || undefined,
      });
      setChangelog(data.items);
      setChangelogTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load changelog failed");
    } finally {
      setChangelogLoading(false);
    }
  }, [idToken, changelogOffset, changelogAction]);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    startTransition(() => {
      setBootLoading(true);
      setError(null);
    });
    api
      .adminRefreshConfig(idToken)
      .then((configData) => {
        if (!cancelled) {
          setConfig(configData);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
        }
      })
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idToken]);

  useEffect(() => {
    if (!idToken || bootLoading) return;
    const timer = window.setTimeout(() => void loadRuns(), 0);
    return () => window.clearTimeout(timer);
  }, [idToken, bootLoading, loadRuns]);

  useEffect(() => {
    if (!idToken || bootLoading) return;
    const timer = window.setTimeout(() => void loadChangelog(), 0);
    return () => window.clearTimeout(timer);
  }, [idToken, bootLoading, loadChangelog]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAuditLog(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAuditLog]);

  useEffect(() => {
    if (!idToken) return;
    const hasActive = runs.some((r) => r.status === "pending" || r.status === "running");
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      api.adminSeedJobs(idToken, PAGE_SIZE, runsOffset).then((data) => {
        setRuns(data.items);
        setRunsTotal(data.total);
      }).catch(() => {});
    }, 3000);
    return () => window.clearInterval(timer);
  }, [idToken, runs, runsOffset]);

  async function triggerSeed() {
    if (!idToken) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.adminTriggerSeedJob(idToken, {
        location: location.trim(),
        radius_m: milesToMeters(radiusMi),
        force,
      });
      setMessage(
        res.reused
          ? `Reused recent run ${res.job.id.slice(0, 8)}… (${res.job.status})`
          : `Started run ${res.job.id.slice(0, 8)}…`,
      );
      setRunsOffset(0);
      await Promise.all([loadRuns(0), loadChangelog(0)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  }

  async function triggerRefreshAll() {
    if (!idToken) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.adminTriggerRefreshRuns(idToken);
      const job = res.jobs[0];
      setMessage(
        job
          ? `Started catalog refresh run ${job.id.slice(0, 8)}…`
          : "Started catalog refresh run",
      );
      setRunsOffset(0);
      await Promise.all([loadRuns(0), loadChangelog(0)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveConfig() {
    if (!idToken || !config) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.adminUpdateRefreshConfig(idToken, {
        enabled: config.enabled,
        schedule_cron: config.schedule_cron,
        schedule_timezone: config.schedule_timezone,
      });
      setConfig(res.config);
      const syncNote =
        res.scheduler_sync.status === "synced"
          ? "Cloud Scheduler updated."
          : res.scheduler_sync.status === "skipped"
            ? "Scheduler sync skipped (not configured in this environment)."
            : `Scheduler sync failed: ${res.scheduler_sync.detail ?? "unknown error"}`;
      setMessage(`Scheduled catalog refresh settings saved. ${syncNote}`);
      toast("Scheduled catalog refresh settings saved", "success");
      setAuditOffset(0);
      await loadAuditLog(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Catalog &amp; refresh</h1>
          <p className="text-text-muted">
            The scheduled job runs Place Details on every known restaurant to keep it fresh.
            Catalog growth comes from user coverage requests — pre-seeding is only for cold
            starts.
          </p>
        </div>
      </header>

      {bootLoading && <p className="text-text-muted">Loading…</p>}
      {error && <p className="text-sm font-semibold text-error">{error}</p>}
      {message && <p className="text-text-muted">{message}</p>}

      {!bootLoading && config && (
        <>
          <details className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <summary className="cursor-pointer text-lg font-semibold">
              Bootstrap an area (cold start)
            </summary>
            <p className="mt-3 text-sm text-text-muted">
              Coverage normally grows on its own: signed-in users trigger background seeding of
              their area, and searches materialize venues on demand. Pre-seed only when launching
              a new area, so the first user does not see an empty map. Enter a ZIP code, city, or
              address — we geocode it and search Google Places nearby.
            </p>
            <form
              className="mt-4 flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                triggerSeed();
              }}
            >
              <input
                placeholder="e.g. 02026, Norwood MA, or a city center"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
              <FormField label="Radius (mi)" className="gap-1">
                <input
                  type="number"
                  min={MIN_RADIUS_MI}
                  max={MAX_RADIUS_MI}
                  step={0.5}
                  value={radiusMi}
                  onChange={(e) => setRadiusMi(Number(e.target.value))}
                />
              </FormField>
              <CheckboxField
                label="Force (ignore cooldown)"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
              />
              <Button type="submit" disabled={busy || !location.trim()}>
                {busy ? "Starting…" : "Start seed run"}
              </Button>
            </form>
          </details>

          <section className="grid gap-6 rounded-lg border border-border bg-surface p-5 shadow-sm [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
            <div>
              <h2 className="mb-3 text-lg">Scheduled catalog refresh</h2>
              <p className="text-sm text-text-muted">
                The scheduled job runs Google Place Details on every restaurant already in the
                catalog — tombstoning venues Google no longer serves and updating closed status.
                It does not search for new areas; catalog growth comes from user coverage
                requests and the bootstrap form above. Saving updates the Cloud Scheduler job
                schedule and pause state in GCP.
              </p>
              <div className="flex max-w-md flex-col items-stretch gap-3">
                <CheckboxField
                  label="Enabled"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                />
                <FormField label="Schedule (cron)" className="gap-1">
                  <input
                    value={config.schedule_cron}
                    onChange={(e) => setConfig({ ...config, schedule_cron: e.target.value })}
                  />
                </FormField>
                <FormField label="Timezone" className="gap-1">
                  <input
                    value={config.schedule_timezone}
                    onChange={(e) => setConfig({ ...config, schedule_timezone: e.target.value })}
                  />
                </FormField>
                <p className="text-sm text-text-muted">
                  Last scheduled: {fmtTime(config.last_scheduled_at)}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={saveConfig} disabled={busy}>
                    Save settings
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={triggerRefreshAll}
                    disabled={busy || !config.enabled}
                  >
                    Run refresh now
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-3 text-lg">Refresh audit log</h2>
            <p className="text-sm text-text-muted">
              Who enabled or disabled the scheduled catalog refresh or changed its schedule —
              plus Cloud Scheduler sync results.
            </p>
            <DataTable
              columns={[
                { key: "when", label: "When" },
                { key: "category", label: "Type" },
                { key: "action", label: "Action" },
                { key: "who", label: "Changed by" },
                { key: "detail", label: "Detail" },
              ]}
              rows={auditLog.map((row) => ({
                key: row.id,
                cells: {
                  when: fmtTime(row.created_at),
                  category: row.category === "refresh_config" ? "Auto-refresh" : "Location",
                  action: auditActionLabel(row.action),
                  who: row.changed_by_email ?? row.changed_by_uid ?? "—",
                  detail: auditSummary(row),
                },
              }))}
            />
            {auditLog.length === 0 && (
              <p className="text-sm text-text-muted">No refresh setting changes recorded yet.</p>
            )}
            <Pagination
              total={auditTotal}
              limit={PAGE_SIZE}
              offset={auditOffset}
              onChange={setAuditOffset}
            />
          </section>

          <GcpInfraPanel links={runs.find((r) => r.gcp_links)?.gcp_links} />

          <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-3 text-lg">Runs</h2>
            <p className="text-sm text-text-muted">
              Each run is a seed/refresh job. Use <strong>Run logs</strong> for lines tagged{" "}
              <code>[seed_job:…]</code> on ttf-api. Pending runs have no logs until Pub/Sub delivers
              the message.
            </p>
            {runsLoading && <p className="text-sm text-text-muted">Updating…</p>}
            <DataTable
              columns={[
                { key: "when", label: "Started" },
                { key: "area", label: "Area" },
                { key: "status", label: "Status" },
                { key: "added", label: "Added", align: "right" },
                { key: "updated", label: "Updated", align: "right" },
                { key: "tombstoned", label: "Tombstoned", align: "right" },
                { key: "by", label: "Requested by" },
                { key: "logs", label: "" },
              ]}
              rows={runs.map((r) => ({
                key: r.id,
                cells: {
                  when: fmtTime(r.started_at ?? r.created_at),
                  area: (
                    <div>
                      <div>{r.query ?? `${r.lat.toFixed(3)}, ${r.lng.toFixed(3)}`}</div>
                      <div className="text-sm text-text-muted">
                        {r.kind === "catalog"
                          ? "full catalog"
                          : fmtRadiusMi(r.radius_m)}
                        {r.refresh ? " · refresh" : ""}
                      </div>
                    </div>
                  ),
                  status: (
                    <span className={statusClass(r.status)}>
                      {r.status}
                      {r.error && <div className="text-sm text-text-muted">{r.error}</div>}
                    </span>
                  ),
                  added: r.inserted_count,
                  updated: r.updated_count,
                  tombstoned: r.tombstoned_count,
                  by: r.requested_by_display ?? r.requested_by ?? "—",
                  logs: (
                    <div className="flex flex-col items-start gap-1">
                      <GcpLink href={r.gcp_links?.run_logs_url} title="Logs for this run">
                        Run logs
                      </GcpLink>
                      {r.status === "pending" && (
                        <span className="text-sm text-text-muted">Queued</span>
                      )}
                    </div>
                  ),
                },
              }))}
            />
            <Pagination
              total={runsTotal}
              limit={PAGE_SIZE}
              offset={runsOffset}
              onChange={setRunsOffset}
            />
          </section>

          <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-lg">Change log</h2>
              <FormField label="Action" className="min-w-[min(100%,12rem)]">
                <select
                  value={changelogAction}
                  onChange={(e) => {
                    setChangelogOffset(0);
                    setChangelogAction(e.target.value);
                  }}
                >
                  <option value="">All actions</option>
                  <option value="added">Added</option>
                  <option value="updated">Updated</option>
                  <option value="tombstoned">Tombstoned</option>
                  <option value="reactivated">Reactivated</option>
                  <option value="closed">Closed</option>
                  <option value="outside_area">Outside area</option>
                </select>
              </FormField>
            </header>
            {changelogLoading && <p className="text-sm text-text-muted">Updating…</p>}
            <DataTable
              columns={[
                { key: "when", label: "When" },
                { key: "action", label: "Action" },
                { key: "restaurant", label: "Restaurant" },
                { key: "reason", label: "Reason" },
              ]}
              rows={changelog.map((c) => ({
                key: c.id,
                cells: {
                  when: fmtTime(c.created_at),
                  action: (
                    <div>
                      <div>{actionLabel(c.action)}</div>
                      {c.previous_status && c.new_status && (
                        <div className="text-sm text-text-muted">
                          {c.previous_status} → {c.new_status}
                        </div>
                      )}
                    </div>
                  ),
                  restaurant: c.restaurant_name ?? c.google_place_id ?? "—",
                  reason: reasonLabel(c.reason, c.action),
                },
              }))}
            />
            <Pagination
              total={changelogTotal}
              limit={PAGE_SIZE}
              offset={changelogOffset}
              onChange={setChangelogOffset}
            />
          </section>
        </>
      )}
    </div>
  );
}
