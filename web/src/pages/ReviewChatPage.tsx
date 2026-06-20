import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { ReviewChat } from "../components/ReviewChat";
import { Page } from "../components/ui/Page";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";

const backLinkClass =
  "mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition-colors duration-fast hover:text-brand";

export function ReviewChatPage() {
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

  const backTo = id ? `/restaurants/${id}` : `/restaurants/place/${encodeURIComponent(placeId!)}`;

  return (
    <Page
      narrow
      title="Share your visit"
      subtitle={loading ? "Loading…" : name}
      back={
        <Link to={backTo} className={backLinkClass}>
          ← Back
        </Link>
      }
    >
      {!loading && (
        <ReviewChat
          restaurantId={id}
          placeId={placeId}
          restaurantName={name}
        />
      )}
    </Page>
  );
}
