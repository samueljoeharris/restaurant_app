import { type FormEvent, useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { authErrorMessage } from "../auth/errors";
import { AttributeSummary } from "../components/AttributeSummary";
import { ContributionRecencyChart } from "../components/ContributionRecencyChart";
import { RestaurantDetailTabs } from "../components/RestaurantDetailTabs";
import { RestaurantHero } from "../components/RestaurantHero";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Page } from "../components/ui/Page";
import { SkeletonList } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/useToast";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import type { AttributeEntry, RestaurantDetailResponse, RestaurantNote } from "../types";

const backLinkClass =
  "mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition-colors duration-fast hover:text-brand";

export function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { idToken } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<RestaurantDetailResponse | null>(null);
  const [attributes, setAttributes] = useState<AttributeEntry[]>([]);
  const [notes, setNotes] = useState<RestaurantNote[]>([]);
  const [kidsAges, setKidsAges] = useState<number[]>([]);
  const [noteText, setNoteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteBusy, setNoteBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRestaurant = useCallback(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.getRestaurant(id, idToken),
      api.getAttributes(id),
      api.listNotes(id),
      idToken ? api.getProfile(idToken).catch(() => null) : Promise.resolve(null),
    ])
      .then(([detail, attrs, notesRes, profile]) => {
        if (cancelled) return;
        setData(detail);
        setAttributes(Object.values(attrs.attributes));
        setNotes(notesRes.notes);
        if (profile) setKidsAges(profile.kids_ages);
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
  }, [id, idToken]);

  useRefreshOnNavigate(loadRestaurant, [id, idToken]);

  async function handleNoteSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || !idToken || !noteText.trim()) return;
    setNoteBusy(true);
    setNoteError(null);
    try {
      const created = await api.submitNote(id, noteText.trim(), idToken);
      setNotes((prev) => [created, ...prev]);
      setNoteText("");
      toast("Note posted — thanks!", "success");
    } catch (err) {
      setNoteError(authErrorMessage(err));
    } finally {
      setNoteBusy(false);
    }
  }

  if (error) {
    return (
      <Page narrow back={<Link to="/map" className={backLinkClass}>← Explore</Link>}>
        <p className="text-sm font-semibold text-error">{error}</p>
      </Page>
    );
  }

  if (loading || !data || !id) {
    return (
      <Page narrow back={<Link to="/map" className={backLinkClass}>← Explore</Link>}>
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
      back={<Link to="/map" className={backLinkClass}>← Explore</Link>}
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
                  <ButtonLink to={`/restaurants/${r.id}/rate`} variant="secondary" size="sm">
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
                <ButtonLink to={`/restaurants/${r.id}/review`} fullWidth>
                  Chat through your review
                </ButtonLink>
                <ButtonLink to={`/restaurants/${r.id}/submit`} variant="secondary" fullWidth className="mt-2">
                  Submit speed observation
                </ButtonLink>
                <ButtonLink to={`/restaurants/${r.id}/rate`} variant="secondary" fullWidth className="mt-2">
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
