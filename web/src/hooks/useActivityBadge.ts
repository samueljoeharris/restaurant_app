import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { userStorage } from "../lib/userStorage";

const BASE_TITLE = "Little Scout";
const POLL_MS = 60_000;

export function useActivityBadge() {
  const { idToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const baseTitleRef = useRef(BASE_TITLE);
  const displayUnread = idToken ? unreadCount : 0;

  const refresh = useCallback(async () => {
    if (!idToken) {
      setUnreadCount(0);
      document.title = baseTitleRef.current;
      return;
    }
    try {
      const res = await api.getUnreadActivityCount(idToken);
      setUnreadCount(res.unread_count);
      document.title =
        res.unread_count > 0
          ? `(${res.unread_count}) ${baseTitleRef.current}`
          : baseTitleRef.current;
    } catch {
      /* ignore poll errors */
    }
  }, [idToken]);

  useEffect(() => {
    if (!idToken) {
      document.title = baseTitleRef.current;
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await api.getUnreadActivityCount(idToken);
        if (cancelled) return;
        setUnreadCount(res.unread_count);
        document.title =
          res.unread_count > 0
            ? `(${res.unread_count}) ${baseTitleRef.current}`
            : baseTitleRef.current;
      } catch {
        /* ignore poll errors */
      }
    })();

    const id = window.setInterval(() => void refresh(), POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const baseTitle = baseTitleRef.current;
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.title = baseTitle;
    };
  }, [idToken, refresh]);

  const markReadNow = useCallback(async () => {
    if (!idToken) return;
    const through = new Date().toISOString();
    const res = await api.markActivityRead(idToken, through);
    userStorage.setLastSeenAt(through);
    setUnreadCount(res.unread_count);
    document.title = baseTitleRef.current;
  }, [idToken]);

  return { unreadCount: displayUnread, refresh, markReadNow };
}
