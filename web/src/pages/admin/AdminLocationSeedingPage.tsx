import { useCallback, useEffect, useState } from "react";

import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { DataTable, Pagination } from "../../components/admin/DataTable";
import type {
  AdminAuditLogRow,
  LocationRefreshConfig,
  RestaurantChangelogRow,
  RestaurantSeedJob,
  SeedLocation,
} from "../../types";

const PAGE_SIZE = 20;

// Seed runs execute inside the ttf-api Cloud Run service (Pub/Sub push), so the
// GCP view of a run is its Cloud Logging entries filtered by job id + time window.
const GCP_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "";
const API_SERVICE_NAME = "ttf-api";
const LOG_WINDOW_PAD_MS = 5 * 60_000;

function gcpRunLogsUrl(run: RestaurantSeedJob): string | null {
  if (!GCP_PROJECT_ID) return null;
  const query = [
    'resource.type="cloud_run_revision"',
    `resource.labels.service_name="${API_SERVICE_NAME}"`,
    `"${run.id}"`,
  ].join("\n");
  const start = new Date(run.started_at ?? run.created_at).getTime() - LOG_WINDOW_PAD_MS;
  const end = run.finished_at
    ? new Date(run.finished_at).getTime() + LOG_WINDOW_PAD_MS
    : Date.now() + LOG_WINDOW_PAD_MS;
  const params = [
    `query=${encodeURIComponent(query)}`,
    `startTime=${new Date(start).toISOString()}`,
    `endTime=${new Date(end).toISOString()}`,
  ].join(";");
  return `https://console.cloud.google.com/logs/query;${params}?project=${GCP_PROJECT_ID}`;
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function statusClass(status: RestaurantSeedJob["status"]) {
  if (status === "succeeded") return "admin-badge--ok";
  if (status === "failed") return "admin-badge--warn";
  if (status === "running" || status === "pending") return "admin-badge--info";
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

export function AdminLocationSeedingPage() {
  const { idToken } = useAuth();
  const [runs, setRuns] = useState<RestaurantSeedJob[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsOffset, setRunsOffset] = useState(0);
  const [changelog, setChangelog] = useState<RestaurantChangelogRow[]>([]);
  const [changelogTotal, setChangelogTotal] = useState(0);
  const [changelogOffset, setChangelogOffset] = useState(0);
  const [changelogAction, setChangelogAction] = useState("");
  const [config, setConfig] = useState<LocationRefreshConfig | null>(null);
  const [locations, setLocations] = useState<SeedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AdminAuditLogRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditOffset, setAuditOffset] = useState(0);

  const [location, setLocation] = useState("");
  const [radiusM, setRadiusM] = useState(8000);
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

  const load = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    setError(null);
    try {
      const [runsData, changelogData, configData, locationsData] = await Promise.all([
        api.adminSeedJobs(idToken, PAGE_SIZE, runsOffset),
        api.adminRestaurantChangelog(idToken, {
          limit: PAGE_SIZE,
          offset: changelogOffset,
          action: changelogAction || undefined,
        }),
        api.adminRefreshConfig(idToken),
        api.adminSeedLocations(idToken),
      ]);
      setRuns(runsData.items);
      setRunsTotal(runsData.total);
      setChangelog(changelogData.items);
      setChangelogTotal(changelogData.total);
      setConfig(configData);
      setLocations(locationsData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [idToken, runsOffset, changelogOffset, changelogAction]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadAuditLog();
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
        radius_m: radiusM,
        force,
      });
      setMessage(
        res.reused
          ? `Reused recent run ${res.job.id.slice(0, 8)}… (${res.job.status})`
          : `Started run ${res.job.id.slice(0, 8)}…`,
      );
      setRunsOffset(0);
      await load();
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
      setMessage(
        `Started ${res.jobs.length} refresh runs (${res.jobs.length - 1} locations + full catalog)`,
      );
      setRunsOffset(0);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLocation(loc: SeedLocation) {
    if (!idToken) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.adminUpdateSeedLocation(idToken, loc.id, {
        enabled: !loc.enabled,
      });
      setLocations((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setAuditOffset(0);
      await loadAuditLog(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeLocation(loc: SeedLocation) {
    if (!idToken) return;
    if (!window.confirm(`Remove "${loc.label}" from refresh locations?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminDeleteSeedLocation(idToken, loc.id);
      setLocations((prev) => prev.filter((l) => l.id !== loc.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
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
        default_location: config.default_location ?? undefined,
        default_radius_m: config.default_radius_m,
      });
      setConfig(res.config);
      const syncNote =
        res.scheduler_sync.status === "synced"
          ? "Cloud Scheduler updated."
          : res.scheduler_sync.status === "skipped"
            ? "Scheduler sync skipped (not configured in this environment)."
            : `Scheduler sync failed: ${res.scheduler_sync.detail ?? "unknown error"}`;
      setMessage(`Auto-refresh settings saved. ${syncNote}`);
      setAuditOffset(0);
      await loadAuditLog(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page stack">
      <header className="admin-page__header">
        <div>
          <h1>Location seeding</h1>
          <p className="muted">
            Seed new areas from Google Places, manage auto-refresh, and review catalog changes
          </p>
        </div>
      </header>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}

      {!loading && config && (
        <>
          <section className="admin-panel">
            <h2>Seed a new area</h2>
            <p className="muted small">
              Enter a ZIP code, city, or address — we geocode it and search Google Places nearby.
            </p>
            <form
              className="admin-seed-form"
              onSubmit={(e) => {
                e.preventDefault();
                triggerSeed();
              }}
            >
              <input
                className="search"
                placeholder="e.g. 02026, Norwood MA, or Dedham center"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
              <label className="admin-seed-form__field">
                Radius (m)
                <input
                  type="number"
                  min={1000}
                  max={25000}
                  step={500}
                  value={radiusM}
                  onChange={(e) => setRadiusM(Number(e.target.value))}
                />
              </label>
              <label className="admin-seed-form__check">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                />
                Force (ignore cooldown)
              </label>
              <button type="submit" disabled={busy || !location.trim()}>
                {busy ? "Starting…" : "Start seed run"}
              </button>
            </form>
          </section>

          <section className="admin-panel">
            <h2>Refresh locations</h2>
            <p className="muted small">
              Every successfully seeded area is registered here. The scheduled refresh
              re-runs all enabled locations, then refreshes every known restaurant
              regardless of zone via Place Details.
            </p>
            <DataTable
              columns={[
                { key: "label", label: "Location" },
                { key: "radius", label: "Radius", align: "right" },
                { key: "source", label: "Source" },
                { key: "refreshed", label: "Last refreshed" },
                { key: "enabled", label: "Enabled" },
                { key: "actions", label: "" },
              ]}
              rows={locations.map((loc) => ({
                key: loc.id,
                cells: {
                  label: (
                    <div>
                      <div>{loc.label}</div>
                      {loc.query && loc.query !== loc.label && (
                        <div className="muted small">{loc.query}</div>
                      )}
                    </div>
                  ),
                  radius: `${loc.radius_m / 1000} km`,
                  source: loc.source,
                  refreshed: fmtTime(loc.last_refreshed_at),
                  enabled: (
                    <input
                      type="checkbox"
                      checked={loc.enabled}
                      disabled={busy}
                      onChange={() => toggleLocation(loc)}
                    />
                  ),
                  actions: (
                    <button
                      type="button"
                      className="secondary small"
                      disabled={busy}
                      onClick={() => removeLocation(loc)}
                    >
                      Remove
                    </button>
                  ),
                },
              }))}
            />
            {locations.length === 0 && (
              <p className="muted small">
                No locations yet — seed an area above and it will appear here.
              </p>
            )}
          </section>

          <section className="admin-panel admin-panel--split">
            <div>
              <h2>Auto-refresh</h2>
              <p className="muted small">
                Scheduled refresh re-seeds all enabled locations and the full catalog,
                tombstoning venues missing from Places and updating closed status.
                Saving updates the Cloud Scheduler job schedule and pause state in GCP.
              </p>
              <div className="admin-seed-form admin-seed-form--config">
                <label className="admin-seed-form__check">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  />
                  Enabled
                </label>
                <label className="admin-seed-form__field">
                  Schedule (cron)
                  <input
                    value={config.schedule_cron}
                    onChange={(e) => setConfig({ ...config, schedule_cron: e.target.value })}
                  />
                </label>
                <label className="admin-seed-form__field">
                  Timezone
                  <input
                    value={config.schedule_timezone}
                    onChange={(e) => setConfig({ ...config, schedule_timezone: e.target.value })}
                  />
                </label>
                <label className="admin-seed-form__field">
                  Default area
                  <input
                    value={config.default_location ?? ""}
                    onChange={(e) => setConfig({ ...config, default_location: e.target.value })}
                  />
                </label>
                <label className="admin-seed-form__field">
                  Radius (m)
                  <input
                    type="number"
                    min={1000}
                    max={25000}
                    value={config.default_radius_m}
                    onChange={(e) =>
                      setConfig({ ...config, default_radius_m: Number(e.target.value) })
                    }
                  />
                </label>
                <p className="muted small">
                  Last scheduled: {fmtTime(config.last_scheduled_at)}
                </p>
                <div className="admin-seed-form__actions">
                  <button type="button" onClick={saveConfig} disabled={busy}>
                    Save settings
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={triggerRefreshAll}
                    disabled={busy || !config.enabled}
                  >
                    Run refresh now
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="admin-panel">
            <h2>Refresh audit log</h2>
            <p className="muted small">
              Who enabled or disabled auto-refresh, changed the schedule, or toggled refresh
              locations — plus Cloud Scheduler sync results.
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
              <p className="muted small">No refresh setting changes recorded yet.</p>
            )}
            <Pagination
              total={auditTotal}
              limit={PAGE_SIZE}
              offset={auditOffset}
              onChange={setAuditOffset}
            />
          </section>

          <section className="admin-panel">
            <h2>Runs</h2>
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
                      <div className="muted small">
                        {r.kind === "catalog"
                          ? "full catalog"
                          : `${r.radius_m / 1000} km`}
                        {r.refresh ? " · refresh" : ""}
                      </div>
                    </div>
                  ),
                  status: (
                    <span className={statusClass(r.status)}>
                      {r.status}
                      {r.error && <div className="muted small">{r.error}</div>}
                    </span>
                  ),
                  added: r.inserted_count,
                  updated: r.updated_count,
                  tombstoned: r.tombstoned_count,
                  by: r.requested_by ?? "—",
                  logs: (() => {
                    const url = gcpRunLogsUrl(r);
                    return url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="small"
                        title="Open this run's logs in Google Cloud Logging"
                      >
                        GCP logs ↗
                      </a>
                    ) : (
                      "—"
                    );
                  })(),
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

          <section className="admin-panel">
            <header className="admin-page__header">
              <h2>Change log</h2>
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
            </header>
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
                        <div className="muted small">
                          {c.previous_status} → {c.new_status}
                        </div>
                      )}
                    </div>
                  ),
                  restaurant: c.restaurant_name ?? c.google_place_id ?? "—",
                  reason: c.reason ?? "—",
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
