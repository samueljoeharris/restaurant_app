import { Link, useParams } from "react-router-dom";
import { useCallback, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Page } from "../components/ui/Page";
import { SkeletonList } from "../components/ui/Skeleton";
import { Stat, StatGrid } from "../components/ui/Stat";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import { restaurantSubmitPath } from "../lib/mapEntryKey";
import type { RestaurantMapEntry } from "../types";

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
      <Page narrow back={<Link to="/map" className="back-link">← Explore</Link>}>
        <EmptyState title="Sign in required" description="Sign in to view restaurant details from Google Places." />
      </Page>
    );
  }
  if (error) {
    return (
      <Page narrow back={<Link to="/map" className="back-link">← Explore</Link>}>
        <p className="error">{error}</p>
      </Page>
    );
  }
  if (loading || !entry) {
    return (
      <Page narrow back={<Link to="/map" className="back-link">← Explore</Link>}>
        <SkeletonList count={3} />
      </Page>
    );
  }

  const hasTtf = entry.ttf.sample_size > 0;
  return (
    <Page narrow back={<Link to="/map" className="back-link">← Explore</Link>} title={entry.name} subtitle={entry.address}>
      <Card>
        <p className="muted small">Listed via Google Places. Parent ratings appear after the first contribution.</p>
        {hasTtf ? (
          <StatGrid>
            <Stat label="Median TTF" value={entry.ttf.median_minutes?.toFixed(0) ?? "—"} hint="minutes" />
            <Stat label="Quality" value={entry.ttf.avg_quality?.toFixed(1) ?? "—"} />
            <Stat label="Visits" value={entry.ttf.sample_size} />
          </StatGrid>
        ) : (
          <EmptyState title="Not scouted yet" description="Be the first parent to log how fast kid-friendly starters arrive." />
        )}
        <div className="stack gap-sm" style={{ marginTop: "1rem" }}>
          <ButtonLink to={restaurantSubmitPath(entry)} fullWidth>{hasTtf ? "Log another visit" : "Log a visit"}</ButtonLink>
          {entry.id && <ButtonLink to={`/restaurants/${entry.id}`} variant="secondary" fullWidth>Open rated profile</ButtonLink>}
        </div>
      </Card>
    </Page>
  );
}
