import { useEffect, useState } from "react";

import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { ActivityChart } from "../../components/admin/ActivityChart";
import { Stat, StatGrid } from "../../components/ui/Stat";
import type { AdminActivityDay, AdminOverviewStats } from "../../types";

function fmtNum(n: number | null | undefined, digits = 1) {
  if (n == null) return "—";
  return Number(n).toFixed(digits);
}

export function AdminDashboardPage() {
  const { idToken } = useAuth();
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [activity, setActivity] = useState<AdminActivityDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([api.adminStats(idToken), api.adminActivity(idToken, 14)])
      .then(([s, a]) => {
        if (!cancelled) {
          setStats(s);
          setActivity(a.days);
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
  }, [idToken]);

  if (loading) return <p className="muted">Loading dashboard…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!stats) return null;

  const coveragePct =
    stats.restaurant_count > 0
      ? Math.round((stats.restaurants_with_any_data / stats.restaurant_count) * 100)
      : 0;

  return (
    <div className="admin-page stack">
      <header className="admin-page__header">
        <div>
          <h1>Overview</h1>
          <p className="muted">{stats.pilot_display_name} pilot</p>
        </div>
      </header>

      <StatGrid>
        <Stat label="Restaurants" value={stats.restaurant_count} highlight />
        <Stat label="Contributors" value={stats.contributor_count} />
        <Stat label="Speed observations" value={stats.ttf_observation_count} />
        <Stat label="Attribute ratings" value={stats.attribute_rating_count} />
        <Stat label="Notes" value={stats.note_count} />
        <Stat
          label="Median speed"
          value={stats.median_ttf_minutes != null ? `${fmtNum(stats.median_ttf_minutes, 0)} min` : "—"}
          hint={stats.avg_ttf_quality != null ? `avg quality ${fmtNum(stats.avg_ttf_quality)}` : undefined}
        />
        <Stat
          label="Coverage"
          value={`${coveragePct}%`}
          hint={`${stats.restaurants_with_any_data} venues with data`}
        />
        <Stat
          label="Last 7 days"
          value={stats.ttf_last_7_days + stats.attribute_ratings_last_7_days + stats.notes_last_7_days}
          hint={`${stats.ttf_last_7_days} speed · ${stats.attribute_ratings_last_7_days} attrs · ${stats.notes_last_7_days} notes`}
        />
      </StatGrid>

      <section className="admin-panel">
        <h2>Activity (14 days)</h2>
        <ActivityChart days={activity} />
      </section>

      <section className="admin-panel admin-panel--split">
        <div>
          <h3>Restaurants with speed data</h3>
          <p className="admin-panel__big">{stats.restaurants_with_ttf}</p>
          <p className="muted small">of {stats.restaurant_count} seeded venues</p>
        </div>
        <div>
          <h3>Any parent data</h3>
          <p className="admin-panel__big">{stats.restaurants_with_any_data}</p>
          <p className="muted small">Speed, attributes, or notes</p>
        </div>
      </section>
    </div>
  );
}
