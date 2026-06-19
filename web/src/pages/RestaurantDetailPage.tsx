import { type FormEvent, useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { authErrorMessage } from "../auth/errors";
import { AttributeSummary } from "../components/AttributeSummary";
import { ContributionRecencyChart } from "../components/ContributionRecencyChart";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonAnchor, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Page } from "../components/ui/Page";
import { SkeletonList } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/useToast";
import { Stat, StatGrid } from "../components/ui/Stat";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import type { AttributeEntry, RestaurantDetailResponse, RestaurantNote } from "../types";

export function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { idToken } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<RestaurantDetailResponse | null>(null);
  const [attributes, setAttributes] = useState<AttributeEntry[]>([]);
  const [notes, setNotes] = useState<RestaurantNote[]>([]);
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
    Promise.all([api.getRestaurant(id), api.getAttributes(id), api.listNotes(id)])
      .then(([detail, attrs, notesRes]) => {
        if (cancelled) return;
        setData(detail);
        setAttributes(Object.values(attrs.attributes));
        setNotes(notesRes.notes);
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
  }, [id]);

  useRefreshOnNavigate(loadRestaurant, [id]);

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
      <Page narrow back={<Link to="/restaurants" className="back-link">← Explore</Link>}>
        <p className="error">{error}</p>
      </Page>
    );
  }

  if (loading || !data) {
    return (
      <Page narrow back={<Link to="/restaurants" className="back-link">← Explore</Link>}>
        <SkeletonList count={2} />
      </Page>
    );
  }

  const { restaurant: r, ttf, contribution_recency } = data;

  return (
    <Page
      narrow
      title={r.name}
      subtitle={r.address}
      back={<Link to="/restaurants" className="back-link">← Explore</Link>}
    >
      {r.cuisine_tags.length > 0 && (
        <div className="tag-row">
          {r.cuisine_tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <Card
        title="Share your visit"
        subtitle="Describe your meal in your own words"
        accent
      >
        {idToken ? (
          <ButtonLink to={`/restaurants/${r.id}/review`} fullWidth>
            Chat through your review
          </ButtonLink>
        ) : (
          <p className="muted small">
            <Link to="/login">Sign in</Link> to use the review assistant.
          </p>
        )}
      </Card>

      {contribution_recency.total > 0 && (
        <Card
          title="Community activity"
          subtitle="When parents last shared speed and kid-friendly ratings"
        >
          <ContributionRecencyChart recency={contribution_recency} />
        </Card>
      )}

      <Card title="Kid food speed" subtitle="How fast did kid food arrive?" accent>
        {ttf.sample_size === 0 ? (
          <EmptyState
            emoji="⏱️"
            title="No speed data yet"
            description="Be the first parent to clock a visit."
            action={
              <ButtonLink to={`/restaurants/${r.id}/submit`} fullWidth>
                Start the timer
              </ButtonLink>
            }
          />
        ) : (
          <>
            <StatGrid>
              <Stat label="Median" value={`${ttf.median_minutes ?? "—"}m`} highlight />
              <Stat label="Quality" value={ttf.avg_quality?.toFixed(1) ?? "—"} />
              <Stat label="Visits" value={ttf.sample_size} />
            </StatGrid>
            <ButtonLink to={`/restaurants/${r.id}/submit`} fullWidth>
              Submit observation
            </ButtonLink>
          </>
        )}
      </Card>

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
        {!idToken && (
          <p className="muted small">
            <Link to="/login">Sign in</Link> to add ratings.
          </p>
        )}
      </Card>

      <Card title="Parent notes" subtitle="Tips from other families">
        {notes.length === 0 ? (
          <p className="muted small">No notes yet.</p>
        ) : (
          <ul className="notes-list">
            {notes.map((note) => (
              <li key={note.id}>
                <p>{note.text}</p>
                {note.tags.length > 0 && (
                  <div className="tag-row">
                    {note.tags.map((tag) => (
                      <Badge key={tag} tone="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <time className="muted small">
                  {new Date(note.created_at).toLocaleDateString()}
                </time>
              </li>
            ))}
          </ul>
        )}
        {idToken ? (
          <form className="stack" onSubmit={handleNoteSubmit}>
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
            {noteError && <p className="error">{noteError}</p>}
            <Button type="submit" disabled={noteBusy || !noteText.trim()}>
              {noteBusy ? "Posting…" : "Post note"}
            </Button>
          </form>
        ) : (
          <p className="muted small">
            <Link to="/login">Sign in</Link> to leave a note.
          </p>
        )}
      </Card>

      <div className="row-actions">
        <ButtonLink to={`/map?focus=${r.id}`} variant="secondary" fullWidth>
          View on map
        </ButtonLink>
        {r.google_maps_url && (
          <ButtonAnchor
            href={r.google_maps_url}
            target="_blank"
            rel="noreferrer"
            variant="ghost"
            fullWidth
          >
            Open in Google Maps
          </ButtonAnchor>
        )}
      </div>
    </Page>
  );
}
