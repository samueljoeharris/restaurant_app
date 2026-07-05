import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { useBlockingModalOpen } from "../hooks/useModalPresence";
import type { ActivityEventItem } from "../types";
import { userStorage } from "../lib/userStorage";
import { cn } from "../lib/cn";
import { Z } from "../lib/overlayStack";

export function ActivityToast() {
  const { idToken } = useAuth();
  // Stay quiet while a blocking modal (onboarding) is open; the unread event
  // is not consumed, so it surfaces on the next poll after the modal closes.
  const modalOpen = useBlockingModalOpen();
  const [toast, setToast] = useState<ActivityEventItem | null>(null);

  useEffect(() => {
    if (!idToken || modalOpen || document.hidden) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await api.getActivityInbox(idToken!, { limit: 1, unread_only: true });
        const latest = res.items[0];
        if (!latest || cancelled) return;
        const lastId = userStorage.getLastToastEventId();
        if (lastId === latest.id) return;
        userStorage.setLastToastEventId(latest.id);
        setToast(latest);
        window.setTimeout(() => setToast(null), 4000);
      } catch {
        /* ignore */
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [idToken, modalOpen]);

  if (!toast || modalOpen) return null;

  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 max-w-sm rounded-lg border border-border bg-surface p-4 shadow-lg",
        "animate-in slide-in-from-bottom-2",
      )}
      style={{ zIndex: Z.toast }}
      role="status"
    >
      <p className="m-0 text-sm font-semibold">{toast.restaurant_name}</p>
      <p className="mt-1 text-sm text-text-muted">{toast.headline}</p>
      <Link
        to={`/restaurants/${toast.restaurant_id}`}
        className="mt-2 inline-block text-sm font-semibold text-brand"
        onClick={() => setToast(null)}
      >
        View update
      </Link>
    </div>
  );
}
