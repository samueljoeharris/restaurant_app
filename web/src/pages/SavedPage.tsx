import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { OnboardingModal } from "../components/OnboardingModal";
import { PushPrimeBanner } from "../components/PushPrimeBanner";
import { WatchButton } from "../components/WatchButton";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Page } from "../components/ui/Page";
import { SkeletonList } from "../components/ui/Skeleton";
import { useActivityBadge } from "../hooks/useActivityBadge";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import { formatTtfMedian } from "../lib/ttfTier";
import type { WatchedRestaurantEntry } from "../types";
import { userStorage } from "../lib/userStorage";
import { WATCHLIST_CHANGED_EVENT } from "../lib/watchlist";
import { useWatch } from "../hooks/useWatch";

function SavedRow({ entry }: { entry: WatchedRestaurantEntry }) {
  const r = entry.restaurant;
  const id = r.id!;
  const { watched, busy, toggle } = useWatch(id, true);
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3">
      <div className="min-w-0">
        <Link to={`/restaurants/${id}`} className="font-bold hover:text-brand">
          {r.name}
        </Link>
        <p className="mt-1 text-sm text-text-muted">{r.address}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {r.ttf.sample_size > 0 ? (
            <Badge variant="brand">Speed {formatTtfMedian(r.ttf)}</Badge>
          ) : (
            <span className="text-text-muted">No speed data yet</span>
          )}
        </div>
      </div>
      <WatchButton watched={watched} busy={busy} onClick={() => void toggle()} size="sm" />
    </div>
  );
}

export function SavedPage() {
  const { idToken } = useAuth();
  const { unreadCount } = useActivityBadge();
  const [items, setItems] = useState<WatchedRestaurantEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPushPrime, setShowPushPrime] = useState(false);
  const [stripDismissed, setStripDismissed] = useState(false);

  const load = useCallback(async () => {
    if (!idToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [watches, profile] = await Promise.all([
        api.listWatches(idToken),
        api.getProfile(idToken),
      ]);
      setItems(watches.items);
      if (!profile.onboarding_completed) setShowOnboarding(true);
      const prime = userStorage.getPushPrimeState();
      setShowPushPrime(watches.items.length > 0 && !prime.firstSavePromptShown);
      userStorage.setProfileCache({
        kidsAges: profile.kids_ages,
        homeLabel: profile.home_label,
        onboardingCompleted: profile.onboarding_completed,
        inboxReadThrough: profile.inbox_read_through,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load saved spots");
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useRefreshOnNavigate(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onWatchlistChanged = () => {
      void load();
    };
    window.addEventListener(WATCHLIST_CHANGED_EVENT, onWatchlistChanged);
    return () => window.removeEventListener(WATCHLIST_CHANGED_EVENT, onWatchlistChanged);
  }, [load]);

  const stripVisible =
    unreadCount > 0 &&
    !stripDismissed &&
    userStorage.getStripDismissedAt() !== new Date().toDateString();

  return (
    <Page title="Saved" subtitle="Spots you're watching for kid-friendly updates">
      {showOnboarding && idToken && (
        <OnboardingModal
          open={showOnboarding}
          idToken={idToken}
          onComplete={() => {
            setShowOnboarding(false);
            void load();
          }}
        />
      )}
      <PushPrimeBanner
        visible={showPushPrime}
        onDismiss={() => setShowPushPrime(false)}
        onEnable={() => {
          const state = userStorage.getPushPrimeState();
          userStorage.setPushPrimeState({ ...state, firstSavePromptShown: true });
          setShowPushPrime(false);
          if ("Notification" in window) {
            void Notification.requestPermission();
          }
        }}
      />
      {stripVisible && (
        <Card className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <p className="m-0 text-sm font-semibold">
              {unreadCount} update{unreadCount === 1 ? "" : "s"} since you last checked
            </p>
            <button
              type="button"
              className="text-sm font-semibold text-text-muted"
              onClick={() => {
                userStorage.setStripDismissedAt(new Date().toDateString());
                setStripDismissed(true);
              }}
            >
              Dismiss
            </button>
          </div>
        </Card>
      )}
      {error && <p className="text-sm font-semibold text-error">{error}</p>}
      {loading && <SkeletonList count={3} />}
      {!loading && items.length === 0 && (
        <Card title="No saved spots yet">
          <p className="text-sm text-text-muted">
            Tap ♡ Watch on a restaurant to follow updates here.
          </p>
          <Link to="/map" className="mt-3 inline-block text-sm font-semibold text-brand">
            Explore the map →
          </Link>
        </Card>
      )}
      {!loading && items.length > 0 && (
        <div>
          {items.map((entry) => (
            <SavedRow key={entry.restaurant.id} entry={entry} />
          ))}
        </div>
      )}
    </Page>
  );
}
