import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api/client";
import { ReviewChat } from "../components/ReviewChat";
import { Page } from "../components/ui/Page";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";

const backLinkClass =
  "mb-4 inline-flex items-center gap-1 text-sm font-semibold text-text-muted transition-colors duration-fast hover:text-brand";

export function ReviewChatPage() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api
      .getRestaurant(id)
      .then((detail) => setName(detail.restaurant.name))
      .finally(() => setLoading(false));
  }, [id]);

  useRefreshOnNavigate(load, [id]);

  if (!id) return null;

  return (
    <Page
      narrow
      title="Share your visit"
      subtitle={loading ? "Loading…" : name}
      back={
        <Link to={`/restaurants/${id}`} className={backLinkClass}>
          ← Back
        </Link>
      }
    >
      {!loading && <ReviewChat restaurantId={id} restaurantName={name} />}
    </Page>
  );
}
