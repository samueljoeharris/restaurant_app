import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { ReviewChat } from "../components/ReviewChat";
import { BackLink } from "../components/ui/BackLink";
import { Page } from "../components/ui/Page";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import { restaurantDetailPath } from "../lib/mapEntryKey";

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

  const backTo = restaurantDetailPath({ id: id ?? null, google_place_id: placeId ?? null });

  return (
    <Page
      narrow
      title="Share your visit"
      subtitle={loading ? "Loading…" : name}
      back={
        <BackLink to={backTo}>
          ← Back
        </BackLink>
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
