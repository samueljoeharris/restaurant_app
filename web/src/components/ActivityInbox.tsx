import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import type { ActivityEventItem } from "../types";
import { useActivityBadge } from "../hooks/useActivityBadge";
import { cn } from "../lib/cn";
import { Button } from "./ui/Button";

const PANEL_WIDTH = 352;

function clampPanelLeft(triggerLeft: number, width: number) {
  const maxLeft = window.innerWidth - width - 8;
  return Math.max(8, Math.min(triggerLeft, maxLeft));
}

export function ActivityInbox() {
  const { idToken } = useAuth();
  const { unreadCount, markReadNow } = useActivityBadge();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: PANEL_WIDTH,
  });

  const loadInbox = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await api.getActivityInbox(idToken, { limit: 30, unread_only: false });
      setItems(res.items);
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  const updatePanelPosition = useCallback(() => {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    setPanelStyle({
      top: rect.bottom + 8,
      left: clampPanelLeft(rect.left, width),
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (!idToken) return null;

  const panel = open
    ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[100] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
            style={{
              top: panelStyle.top,
              left: panelStyle.left,
              width: panelStyle.width,
            }}
            role="dialog"
            aria-label="Activity updates"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="m-0 text-sm font-bold">Updates</h3>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => void markReadNow()}>
                  Mark read
                </Button>
              )}
            </header>
            <div className="max-h-80 overflow-y-auto">
              {loading && <p className="p-4 text-sm text-text-muted">Loading…</p>}
              {!loading && items.length === 0 && (
                <p className="p-4 text-sm text-text-muted">No updates yet on saved spots.</p>
              )}
              {!loading &&
                items.map((item) => (
                  <Link
                    key={item.id}
                    to={`/restaurants/${item.restaurant_id}`}
                    className={cn(
                      "block border-b border-border/60 px-4 py-3 text-sm transition-colors hover:bg-brand-soft/40",
                    )}
                    onClick={() => setOpen(false)}
                  >
                    <span className="font-semibold">{item.restaurant_name}</span>
                    <span className="mt-1 block text-text-muted">{item.headline}</span>
                  </Link>
                ))}
            </div>
          </div>,
          document.body,
        )
    : null;

  return (
    <>
      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-lg"
          aria-label="Activity inbox"
          aria-expanded={open}
          onClick={() => {
            setOpen((v) => {
              const next = !v;
              if (next) void loadInbox();
              return next;
            });
          }}
        >
          🔔
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-text-inverse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>
      {panel}
    </>
  );
}
