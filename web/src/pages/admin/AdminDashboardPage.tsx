import { useEffect, useState, startTransition } from "react";

import { api } from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { AttentionCard } from "../../components/admin/AttentionCard";
import { ActivityChart } from "../../components/admin/ActivityChart";
import { Stat, StatGrid } from "../../components/ui/Stat";
import { ButtonLink } from "../../components/ui/Button";
import type { AdminActivityDay, AdminAttentionStats, AdminOverviewStats } from "../../types";

function fmtNum(n: number | null | undefined, digits = 1) {
  if (n == null) return "—";
  return Number(n).toFixed(digits);
}

export function AdminDashboardPage() {
  const { idToken, refreshClaims } = useAuth();
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [attention, setAttention] = useState<AdminAttentionStats | null>(null);
  const [activity, setActivity] = useState<AdminActivityDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idToken) {
      void refreshClaims();
      return;
    }
    let cancelled = false;
    startTransition(() => setLoading(true));
    Promise.all([
      api.adminStats(idToken),
      api.adminAttention(idToken),
      api.adminActivity(idToken, 14),
    ])
      .then(([s, a, act]) => {
        if (!cancelled) {
          setStats(s);
          setAttention(a);
          setActivity(act.days);
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
  }, [idToken, refreshClaims]);

  if (!idToken || loading) return <p className="text-text-muted">Loading dashboard…</p>;
  if (error) return <p className="text-sm font-semibold text-error">{error}</p>;
  if (!stats || !attention) return <p className="text-text-muted">No dashboard data yet.</p>;

  const coveragePct =
    stats.restaurant_count > 0
      ? Math.round((stats.restaurants_with_any_data / stats.restaurant_count) * 100)
      : 0;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Overview</h1>
          <p className="text-text-muted">{stats.pilot_display_name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/admin/moderation" variant="primary" size="sm">
            Review queue
          </ButtonLink>
          <ButtonLink to="/admin/data?excluded=false" variant="secondary" size="sm">
            Data & observations
          </ButtonLink>
        </div>
      </header>

      <section className="grid gap-3">
        <h2 className="text-lg">Needs attention</h2>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
          <AttentionCard
            label="Pending moderation"
            count={attention.pending_moderation}
            to="/admin/moderation"
            variant={attention.pending_moderation > 0 ? "warning" : "success"}
          />
          <AttentionCard label="Escalated" count={attention.escalated} to="/admin/moderation?status=escalated" />
          <AttentionCard
            label="Flagged speed entries"
            count={attention.flagged_observations}
            to="/admin/data"
          />
          <AttentionCard
            label="New contributors (7d)"
            count={attention.new_contributors_active}
            to="/admin/users?trust=new"
          />
          <AttentionCard
            label="Data quality gaps"
            count={attention.stale_review_count}
            to="/admin/restaurants"
          />
        </div>
      </section>

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
        <Stat label="Coverage" value={`${coveragePct}%`} hint={`${stats.restaurants_with_any_data} venues with data`} />
        <Stat
          label="Last 7 days"
          value={stats.ttf_last_7_days + stats.attribute_ratings_last_7_days + stats.notes_last_7_days}
          hint={`${stats.ttf_last_7_days} speed · ${stats.attribute_ratings_last_7_days} attrs · ${stats.notes_last_7_days} notes`}
        />
      </StatGrid>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 text-lg">Activity (14 days)</h2>
        <ActivityChart days={activity} />
      </section>
    </div>
  );
}
