import { Link } from "react-router-dom";

import { PlacePracticalInfo } from "./PlacePracticalInfo";
import { WatchButton } from "./WatchButton";
import { ButtonLink } from "./ui/Button";
import { Stat, StatGrid } from "./ui/Stat";
import { useWatch } from "../hooks/useWatch";
import { googleMapsUrlForEntry } from "../lib/googleMapsUrl";
import { formatTtfMedian } from "../lib/ttfTier";
import type { AttributeEntry, RestaurantDetailResponse } from "../types";
import { EmptyState } from "./ui/EmptyState";

function ageContextCopy(kidsAges: number[], medianMinutes: number | null) {
  if (!kidsAges.length || medianMinutes === null) return null;
  const youngest = Math.min(...kidsAges);
  if (youngest <= 3) return `${medianMinutes}m — great for toddlers`;
  if (youngest <= 7) return `${medianMinutes}m — solid for young kids`;
  return `${medianMinutes}m — reasonable for older kids`;
}

interface RestaurantHeroProps {
  data: RestaurantDetailResponse;
  attributes: AttributeEntry[];
  id: string;
  idToken: string | null;
  kidsAges?: number[];
}

export function RestaurantHero({ data, attributes, id, idToken, kidsAges = [] }: RestaurantHeroProps) {
  const { restaurant: r, ttf } = data;
  const { watched, busy, toggle } = useWatch(id, data.watched ?? false);
  const googleUrl = googleMapsUrlForEntry(r);
  const topAttrs = attributes.slice(0, 3).map((a) => a.label).join(" · ");
  const ageLine =
    ttf.sample_size > 0
      ? ageContextCopy(kidsAges, ttf.median_minutes)
      : null;

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-brand/25 bg-gradient-to-b from-brand-soft to-surface to-40% p-5 shadow-sm">
      {ttf.sample_size === 0 ? (
        <EmptyState
          emoji="⏱️"
          title="No speed data yet"
          description="Be the first parent to clock a visit."
          actionLabel="Start the timer"
          actionTo={`/restaurants/${id}/submit`}
        />
      ) : (
        <>
          <StatGrid>
            <Stat label="Median" value={`${formatTtfMedian(ttf)}`} highlight />
            <Stat label="Quality" value={ttf.avg_quality?.toFixed(1) ?? "—"} />
            <Stat label="Visits" value={ttf.sample_size} />
          </StatGrid>
          {ageLine && <p className="mt-2 text-sm font-semibold text-brand">{ageLine}</p>}
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <WatchButton watched={watched} busy={busy} onClick={() => void toggle()} />
        <ButtonLink to={`/restaurants/${id}/submit`}>
          {ttf.sample_size === 0 ? "Log visit" : "Log another visit"}
        </ButtonLink>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-text-muted">
        <PlacePracticalInfo target={r} compact />
        {googleUrl && (
          <a href={googleUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand">
            Hours on Google Maps ↗
          </a>
        )}
      </div>
      {topAttrs && (
        <p className="mt-3 text-sm text-text-muted">
          <span className="font-semibold text-text">Parent snapshot:</span> {topAttrs}
        </p>
      )}
      {!idToken && (
        <p className="mt-2 text-sm text-text-muted">
          <Link to="/login">Sign in</Link> to watch this spot and get updates.
        </p>
      )}
    </section>
  );
}
