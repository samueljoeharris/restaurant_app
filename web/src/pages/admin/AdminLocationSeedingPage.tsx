import { useCallback, useEffect, useState } from "react";

import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { DataTable, Pagination } from "../../components/admin/DataTable";
import type {
  LocationRefreshConfig,
  RestaurantChangelogRow,
  RestaurantSeedJob,
} from "../../types";

const PAGE_SIZE = 20;

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [location, setLocation] = useState("");
  const [radiusM, setRadiusM] = useState(8000);
  const [force, setForce] = useState(false);

  const load = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    setError(null);
    try {
      const [runsData, changelogData, configData] = await Promise.all([
        api.adminSeedJobs(idToken, PAGE_SIZE, runsOffset),
        api.adminRestaurantChangelog(idToken, {
          limit: PAGE_SIZE,
          offset: changelogOffset,
          action: changelogAction || undefined,
        }),
        api.adminRefreshConfig(idToken),
      ]);
      setRuns(runsData.items);
      setRunsTotal(runsData.total);
      setChangelog(changelogData.items);
      setChangelogTotal(changelogData.total);
      setConfig(configData);
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

  async function triggerSeed(refresh = false) {
    if (!idToken) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.adminTriggerSeedJob(idToken, refresh
        ? { refresh: true }
        : { location: location.trim(), radius_m: radiusM, force });
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

  async function saveConfig() {
    if (!idToken || !config) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.adminUpdateRefreshConfig(idToken, {
        enabled: config.enabled,
        schedule_cron: config.schedule_cron,
        schedule_timezone: config.schedule_timezone,
        default_location: config.default_location ?? undefined,
        default_radius_m: config.default_radius_m,
      });
      setConfig(updated);
      setMessage("Auto-refresh settings saved");
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
                triggerSeed(false);
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

          <section className="admin-panel admin-panel--split">
            <div>
              <h2>Auto-refresh</h2>
              <p className="muted small">
                Scheduled catalog refresh tombstones venues missing from Places and updates closed status.
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
                    onClick={() => triggerSeed(true)}
                    disabled={busy || !config.enabled}
                  >
                    Run refresh now
                  </button>
                </div>
              </div>
            </div>
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
              ]}
              rows={runs.map((r) => ({
                key: r.id,
                cells: {
                  when: fmtTime(r.started_at ?? r.created_at),
                  area: (
                    <div>
                      <div>{r.query ?? `${r.lat.toFixed(3)}, ${r.lng.toFixed(3)}`}</div>
                      <div className="muted small">
                        {r.radius_m / 1000} km{r.refresh ? " · refresh" : ""}
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
