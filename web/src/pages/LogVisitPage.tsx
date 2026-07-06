import { useCallback, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { ReviewChat } from "../components/ReviewChat";
import { BackLink } from "../components/ui/BackLink";
import { ButtonLink } from "../components/ui/Button";
import { Page } from "../components/ui/Page";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import { restaurantDetailPath, restaurantManualSubmitPath } from "../lib/mapEntryKey";
import { reviewChatAvailable } from "../lib/reviewChat";
import { TtfSubmitPage } from "./TtfSubmitPage";

/**
 * `/submit` entry point (#100). Free-text chat is the primary way to log a
 * visit; the timer/form is the "fill it out yourself" escape hatch.
 *
 * Manual mode wins when any of these hold, so we never hide the DIY form from
 * someone who explicitly wants it:
 *   - `?manual=1` in the URL (the stable DIY / synthetic-user path)
 *   - the review-chat flag is off (no agent to fall back on)
 *   - a "Log it again" prefill was passed (#87 — prefill only feeds the form)
 */
export function LogVisitPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const hasPrefill = Boolean((location.state as { prefill?: unknown } | null)?.prefill);
  const manual = searchParams.get("manual") === "1" || !reviewChatAvailable() || hasPrefill;

  if (manual) return <TtfSubmitPage />;
  return <AgentLogVisit />;
}

/** Agent-first shell: chat primary, extracted draft in a right rail (#100). */
function AgentLogVisit() {
  const { id, placeId } = useParams<{ id?: string; placeId?: string }>();
  const { idToken } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (id) {
      setLoading(true);
      api
        .getRestaurant(id)
        .then((detail) => setName(detail.restaurant.name))
        .finally(() => setLoading(false));
      return;
    }
    if (!placeId || !idToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getPlaceEntry(placeId, idToken)
      .then((entry) => setName(entry.name))
      .finally(() => setLoading(false));
  }, [id, placeId, idToken]);

  useRefreshOnNavigate(load, [id, placeId, idToken]);

  if (!id && !placeId) return null;

  const entry = { id: id ?? null, google_place_id: placeId ?? null };

  return (
    <Page
      title="Log your visit"
      subtitle={loading ? "Loading…" : name}
      back={<BackLink to={restaurantDetailPath(entry)}>← Back</BackLink>}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-muted px-4 py-2.5 text-sm">
        <span className="text-text-muted">Rather not chat? Fill in the timer and form yourself.</span>
        <ButtonLink to={restaurantManualSubmitPath(entry)} variant="secondary" size="sm">
          Fill it out yourself
        </ButtonLink>
      </div>

      {!loading && (
        <ReviewChat layout="sidebar" restaurantId={id} placeId={placeId} restaurantName={name} />
      )}
    </Page>
  );
}
