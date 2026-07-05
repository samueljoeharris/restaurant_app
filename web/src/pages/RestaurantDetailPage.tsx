import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { authErrorMessage } from "../auth/errors";
import { AttributeSummary } from "../components/AttributeSummary";
import { ReportContentButton } from "../components/ReportContentButton";
import { ContributionRecencyChart } from "../components/ContributionRecencyChart";
import { RestaurantDetailTabs } from "../components/RestaurantDetailTabs";
import { RestaurantHero } from "../components/RestaurantHero";
import { BackLink } from "../components/ui/BackLink";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Page } from "../components/ui/Page";
import { SkeletonList } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/useToast";
import { useCachedResource } from "../hooks/useCachedResource";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import {
  invalidateContributionData,
  restaurantDetailCacheKey,
} from "../lib/pageDataCache";
import {
  fetchRestaurantDetailBundle,
  type RestaurantDetailBundle,
} from "../lib/restaurantDetailResource";
import { restaurantRatePath, restaurantReviewPath, restaurantSubmitPath } from "../lib/mapEntryKey";
import { WATCHLIST_CHANGED_EVENT, type WatchlistChangedDetail } from "../lib/watchlist";
import type { AttributeEntry, RestaurantDetailResponse, RestaurantNote } from "../types";

export function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { idToken } = useAuth();
  const { toast } = useToast();
  // Local copies of the cached bundle so optimistic updates (note prepend,
  // watch toggle) can adjust the view without touching the cache.
  const [data, setData] = useState<RestaurantDetailResponse | null>(null);
  const [attributes, setAttributes] = useState<AttributeEntry[]>([]);
  const [notes, setNotes] = useState<RestaurantNote[]>([]);
  const [kidsAges, setKidsAges] = useState<number[]>([]);
  const [noteText, setNoteText] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteBusy, setNoteBusy] = useState(false);

  const { loading, error, refresh } = useCachedResource<RestaurantDetailBundle>(
    id ? restaurantDetailCacheKey(id, Boolean(idToken)) : null,
    () => fetchRestaurantDetailBundle(id!, idToken),
    {
      onData: (bundle) => {
        setData(bundle.detail);
        setAttributes(bundle.attributes);
        setNotes(bundle.notes);
        setKidsAges(bundle.kidsAges);
      },
    },
  );

  useRefreshOnNavigate(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onWatchlistChanged = (event: Event) => {
      const { restaurantId, watched } = (event as CustomEvent<WatchlistChangedDetail>).detail;
      if (restaurantId !== id) return;
      setData((prev) => (prev ? { ...prev, watched } : prev));
    };
    window.addEventListener(WATCHLIST_CHANGED_EVENT, onWatchlistChanged);
    return () => window.removeEventListener(WATCHLIST_CHANGED_EVENT, onWatchlistChanged);
  }, [id]);

  async function handleNoteSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || !idToken || !noteText.trim()) return;
    setNoteBusy(true);
    setNoteError(null);
    try {
      const created = await api.submitNote(id, noteText.trim(), idToken);
      invalidateContributionData(id);
      if (!created.pending_review) {
        setNotes((prev) => [created, ...prev]);
      }
      setNoteText("");
      toast(
        created.pending_review
          ? "Note submitted for review — we'll publish it after a quick check."
          : "Note posted — thanks!",
        created.pending_review ? "default" : "success",
      );
    } catch (err) {
      setNoteError(authErrorMessage(err));
    } finally {
      setNoteBusy(false);
    }
  }

  if (error && !data) {
    return (
      <Page narrow back={<BackLink to="/map" viewTransition>← Explore</BackLink>}>
        <p className="text-sm font-semibold text-error">{error}</p>
      </Page>
    );
  }

  if (loading || !data || !id) {
    return (
      <Page narrow back={<BackLink to="/map" viewTransition>← Explore</BackLink>}>
        <SkeletonList count={2} />
      </Page>
    );
  }

  const { restaurant: r, ttf, contribution_recency } = data;
  const defaultTab = ttf.sample_size === 0 ? "contribute" : "community";

  return (
    <Page
      narrow
      title={r.name}
      subtitle={r.address}
      back={<BackLink to="/map" viewTransition>← Explore</BackLink>}
    >
      {r.cuisine_tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {r.cuisine_tags.map((tag) => (
            <Badge key={tag} variant="neutral">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <RestaurantHero
        data={data}
        attributes={attributes}
        id={id}
        idToken={idToken}
        kidsAges={kidsAges}
      />

      <RestaurantDetailTabs
        defaultTab={defaultTab}
        community={
          <>
            {contribution_recency.total > 0 && (
              <Card
                title="Community activity"
                subtitle="When parents last shared speed and kid-friendly ratings"
              >
                <ContributionRecencyChart recency={contribution_recency} />
              </Card>
            )}
            <Card
              title="Parent ratings"
              subtitle="Stroller access, noise, kids menu, and more"
              action={
                idToken ? (
                  <ButtonLink to={restaurantRatePath(r)} variant="secondary" size="sm">
                    Rate visit
                  </ButtonLink>
                ) : undefined
              }
            >
              <AttributeSummary entries={attributes} />
            </Card>
            <Card title="Parent notes" subtitle="Tips from other families">
              {notes.length === 0 ? (
                <p className="text-sm text-text-muted">No notes yet.</p>
              ) : (
                <ul className="m-0 mb-4 grid list-none gap-3 p-0">
                  {notes.map((note) => (
                    <li key={note.id}>
                      <p className="mb-1">{note.text}</p>
                      {note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {note.tags.map((tag) => (
                            <Badge key={tag} variant="neutral">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <time className="text-sm text-text-muted">
                        {new Date(note.created_at).toLocaleDateString()}
                      </time>
                      <div className="mt-1">
                        <ReportContentButton contentType="note" contentId={note.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {idToken ? (
                <form className="grid gap-3" onSubmit={handleNoteSubmit}>
                  <label>
                    Add a note
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="High chair availability, stroller access, kid-friendly tips…"
                      required
                    />
                  </label>
                  {noteError && <p className="text-sm font-semibold text-error">{noteError}</p>}
                  <Button type="submit" disabled={noteBusy || !noteText.trim()}>
                    {noteBusy ? "Posting…" : "Post note"}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-text-muted">
                  <Link to="/login">Sign in</Link> to leave a note.
                </p>
              )}
            </Card>
          </>
        }
        contribute={
          <Card
            title="Share your visit"
            subtitle="Describe your meal in your own words"
            accent
          >
            {idToken ? (
              <>
                <ButtonLink to={restaurantReviewPath(r)} fullWidth>
                  Chat through your review
                </ButtonLink>
                <ButtonLink to={restaurantSubmitPath(r)} variant="secondary" fullWidth className="mt-2">
                  Submit speed observation
                </ButtonLink>
                <ButtonLink to={restaurantRatePath(r)} variant="secondary" fullWidth className="mt-2">
                  Rate parent attributes
                </ButtonLink>
              </>
            ) : (
              <p className="text-sm text-text-muted">
                <Link to="/login">Sign in</Link> to contribute.
              </p>
            )}
          </Card>
        }
      />

      <ButtonLink to={`/map?focus=${r.id}`} variant="secondary" fullWidth className="mt-4">
        View on map
      </ButtonLink>
    </Page>
  );
}
