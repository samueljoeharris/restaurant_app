import { Link, Navigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { PlacePracticalInfo } from "../components/PlacePracticalInfo";
import { ButtonLink, ButtonAnchor } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Page } from "../components/ui/Page";
import { SkeletonList } from "../components/ui/Skeleton";
import { Stat, StatGrid } from "../components/ui/Stat";
import { useCachedResource } from "../hooks/useCachedResource";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import { placeEntryCacheKey } from "../lib/pageDataCache";
import {
  restaurantRatePath,
  restaurantReviewPath,
  restaurantSubmitPath,
} from "../lib/mapEntryKey";
import { googleMapsUrlForEntry } from "../lib/googleMapsUrl";
import { reviewChatAvailable } from "../lib/reviewChat";
import type { RestaurantMapEntry } from "../types";

const backLinkClass =
  "mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition-colors duration-fast hover:text-brand";

export function PlaceRestaurantDetailPage() {
  const { placeId } = useParams<{ placeId: string }>();
  const { idToken } = useAuth();

  const { data: entry, loading, error, refresh } = useCachedResource<RestaurantMapEntry>(
    placeId && idToken ? placeEntryCacheKey(placeId) : null,
    () => api.getPlaceEntry(placeId!, idToken!),
  );

  useRefreshOnNavigate(() => {
    void refresh();
  }, [refresh]);

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

  if (entry.id) {
    return <Navigate to={`/restaurants/${entry.id}`} replace />;
  }

  const hasTtf = entry.ttf.sample_size > 0;
  const googleMapsUrl = googleMapsUrlForEntry(entry);
  const showReviewChat = reviewChatAvailable();

  return (
    <Page narrow back={<Link to="/map" className={backLinkClass}>← Explore</Link>} title={entry.name} subtitle={entry.address}>
      <Card title="Hours & directions" subtitle="Live info from Google Maps">
        <PlacePracticalInfo target={entry} showWeekdayHours />
      </Card>

      {showReviewChat && (
        <Card
          title="Share your visit"
          subtitle="Describe your meal in your own words"
          accent
        >
          <ButtonLink to={restaurantReviewPath(entry)} fullWidth>
            Chat through your review
          </ButtonLink>
        </Card>
      )}

      <Card title="Kid food speed" subtitle="How fast did kid food arrive?" accent>
        {hasTtf ? (
          <>
            <StatGrid>
              <Stat label="Median" value={`${entry.ttf.median_minutes ?? "—"}m`} highlight />
              <Stat label="Quality" value={entry.ttf.avg_quality?.toFixed(1) ?? "—"} />
              <Stat label="Visits" value={entry.ttf.sample_size} />
            </StatGrid>
            <ButtonLink to={restaurantSubmitPath(entry)} fullWidth>
              Log another visit
            </ButtonLink>
          </>
        ) : (
          <>
            <EmptyState
              emoji="⏱️"
              title="Not scouted yet"
              description="Be the first parent to log how fast kid-friendly starters arrive."
            />
            <ButtonLink to={restaurantSubmitPath(entry)} fullWidth>
              Log a visit
            </ButtonLink>
          </>
        )}
      </Card>

      <Card
        title="Parent ratings"
        subtitle="Stroller access, noise, kids menu, and more"
        action={
          <ButtonLink to={restaurantRatePath(entry)} variant="secondary" size="sm">
            Rate visit
          </ButtonLink>
        }
      >
        <p className="text-sm text-text-muted">
          No parent ratings yet — be the first to share stroller access, noise level, and other
          kid-friendly details.
        </p>
      </Card>

      <div className="grid gap-2">
        {googleMapsUrl && (
          <ButtonAnchor href={googleMapsUrl} target="_blank" rel="noreferrer" variant="secondary" fullWidth>
            View on Google Maps
          </ButtonAnchor>
        )}
      </div>

      <Card>
        <p className="text-sm text-text-muted">
          Listed via Google Places — not in the Little Scout catalog yet. Your first contribution
          adds this spot for other parents.
        </p>
      </Card>
    </Page>
  );
}
