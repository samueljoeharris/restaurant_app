import { useCallback, useEffect, useState, startTransition } from "react";
import type { ReactNode } from "react";

import { api } from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { DataTable, Pagination } from "../../components/admin/DataTable";
import type {
  AdminAuditLogRow,
  GcpConsoleLinks,
  LocationRefreshConfig,
  RestaurantChangelogRow,
  RestaurantSeedJob,
  SeedLocation,
} from "../../types";

const PAGE_SIZE = 20;
const METERS_PER_MILE = 1609.344;
const DEFAULT_RADIUS_MI = 5;
const MIN_RADIUS_MI = 0.6; // ~1000 m API floor
const MAX_RADIUS_MI = 15.5; // ~25000 m API cap

function milesToMeters(mi: number) {
  return Math.round(mi * METERS_PER_MILE);
}

function metersToMiles(m: number) {
  return Math.round((m / METERS_PER_MILE) * 10) / 10;
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
    <a href={href} target="_blank" rel="noreferrer" className="small admin-gcp-link" title={title}>
      {children} ↗
    </a>
  );
}

function GcpInfraPanel({ links }: { links: GcpConsoleLinks | null | undefined }) {
  if (!links) return null;
  return (
    <section className="admin-panel admin-panel--infra">
      <h2>How runs execute in GCP</h2>
      <p className="muted small">
        Runs are rows in Postgres, not separate Cloud Run Jobs. Work is queued on Pub/Sub and
        executed inside the <strong>ttf-api</strong> Cloud Run service. Scheduled refresh uses
        Cloud Scheduler → API → the same queue.
      </p>
      <ul className="admin-gcp-links">
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
    Promise.all([
      api.adminRefreshConfig(idToken),
      api.adminSeedLocations(idToken),
    ])
      .then(([configData, locationsData]) => {
        if (!cancelled) {
          setConfig(configData);
          setLocations(locationsData.items);
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
      setMessage(
        `Started ${res.jobs.length} refresh runs (${res.jobs.length - 1} locations + full catalog)`,
      );
      setRunsOffset(0);
      await Promise.all([loadRuns(0), loadChangelog(0)]);
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

      {bootLoading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}

      {!bootLoading && config && (
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
                placeholder="e.g. 02026, Norwood MA, or a city center"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
              <label className="admin-seed-form__field">
                Radius (mi)
                <input
                  type="number"
                  min={MIN_RADIUS_MI}
                  max={MAX_RADIUS_MI}
                  step={0.5}
                  value={radiusMi}
                  onChange={(e) => setRadiusMi(Number(e.target.value))}
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
                  radius: fmtRadiusMi(loc.radius_m),
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
              <p className="muted small">
                <strong>Default area</strong> is only used when no refresh locations are
                enabled — it geocodes the label below and searches Google Places within the
                radius (default ~5 mi). Once you seed areas above,
                those replace this fallback.
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
                    placeholder="e.g. a city or ZIP code"
                    value={config.default_location ?? ""}
                    onChange={(e) => setConfig({ ...config, default_location: e.target.value })}
                  />
                </label>
                <label className="admin-seed-form__field">
                  Default radius (mi)
                  <input
                    type="number"
                    min={MIN_RADIUS_MI}
                    max={MAX_RADIUS_MI}
                    step={0.5}
                    value={metersToMiles(config.default_radius_m)}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        default_radius_m: milesToMeters(Number(e.target.value)),
                      })
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

          <GcpInfraPanel links={runs.find((r) => r.gcp_links)?.gcp_links} />

          <section className="admin-panel">
            <h2>Runs</h2>
            <p className="muted small">
              Each run is a seed/refresh job. Use <strong>Run logs</strong> for lines tagged{" "}
              <code>[seed_job:…]</code> on ttf-api. Pending runs have no logs until Pub/Sub delivers
              the message.
            </p>
            {runsLoading && <p className="muted small">Updating…</p>}
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
                          : fmtRadiusMi(r.radius_m)}
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
                  by: r.requested_by_display ?? r.requested_by ?? "—",
                  logs: (
                    <div className="admin-gcp-links admin-gcp-links--inline">
                      <GcpLink href={r.gcp_links?.run_logs_url} title="Logs for this run">
                        Run logs
                      </GcpLink>
                      {r.status === "pending" && (
                        <span className="muted small">Queued</span>
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

          <section className="admin-panel">
            <header className="admin-page__header">
              <h2>Change log</h2>
              <label className="admin-filter">
                Action
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
              </label>
            </header>
            {changelogLoading && <p className="muted small">Updating…</p>}
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
