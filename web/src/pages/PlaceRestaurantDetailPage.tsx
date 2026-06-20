import { Link, useParams } from "react-router-dom";
import { useCallback, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { ButtonLink, ButtonAnchor } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Page } from "../components/ui/Page";
import { SkeletonList } from "../components/ui/Skeleton";
import { Stat, StatGrid } from "../components/ui/Stat";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import { restaurantSubmitPath } from "../lib/mapEntryKey";
import { googleMapsUrlForEntry } from "../lib/googleMapsUrl";
import type { RestaurantMapEntry } from "../types";

const backLinkClass =
  "mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition-colors duration-fast hover:text-brand";

export function PlaceRestaurantDetailPage() {
  const { placeId } = useParams<{ placeId: string }>();
  const { idToken } = useAuth();
  const [entry, setEntry] = useState<RestaurantMapEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPlace = useCallback(() => {
    if (!placeId || !idToken) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api.getPlaceEntry(placeId, idToken)
      .then((data) => { if (!cancelled) setEntry(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Load failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [placeId, idToken]);

  useRefreshOnNavigate(loadPlace, [placeId, idToken]);

  if (!idToken) {
    return (
      <Page narrow back={<Link to="/map" className={backLinkClass}>← Explore</Link>}>
        <EmptyState title="Sign in required" description="Sign in to view restaurant details from Google Places." />
      </Page>
    );
  }
  if (error) {
    return (
      <Page narrow back={<Link to="/map" className={backLinkClass}>← Explore</Link>}>
        <p className="text-sm font-semibold text-error">{error}</p>
      </Page>
    );
  }
  if (loading || !entry) {
    return (
      <Page narrow back={<Link to="/map" className={backLinkClass}>← Explore</Link>}>
        <SkeletonList count={3} />
      </Page>
    );
  }

  const hasTtf = entry.ttf.sample_size > 0;
  const googleMapsUrl = googleMapsUrlForEntry(entry);
  return (
    <Page narrow back={<Link to="/map" className={backLinkClass}>← Explore</Link>} title={entry.name} subtitle={entry.address}>
      <Card>
        <p className="text-sm text-text-muted">
          Listed via Google Places — not in the Little Scout catalog yet. Log a visit to add parent
          speed and kid-friendly details.
        </p>
        {hasTtf ? (
          <StatGrid>
            <Stat label="Median TTF" value={entry.ttf.median_minutes?.toFixed(0) ?? "—"} hint="minutes" />
            <Stat label="Quality" value={entry.ttf.avg_quality?.toFixed(1) ?? "—"} />
            <Stat label="Visits" value={entry.ttf.sample_size} />
          </StatGrid>
        ) : (
          <EmptyState title="Not scouted yet" description="Be the first parent to log how fast kid-friendly starters arrive." />
        )}
        <div className="mt-4 grid gap-2">
          <ButtonLink to={restaurantSubmitPath(entry)} fullWidth>
            {hasTtf ? "Log another visit" : "Log a visit"}
          </ButtonLink>
          {googleMapsUrl && (
            <ButtonAnchor href={googleMapsUrl} target="_blank" rel="noreferrer" variant="secondary" fullWidth>
              View on Google Maps
            </ButtonAnchor>
          )}
          {entry.id && (
            <ButtonLink to={`/restaurants/${entry.id}`} variant="ghost" fullWidth>
              Open rated profile
            </ButtonLink>
          )}
        </div>
      </Card>
    </Page>
  );
}
