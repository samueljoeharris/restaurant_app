export const WATCHLIST_CHANGED_EVENT = "ls:watchlist-changed";

export type WatchlistChangedDetail = {
  restaurantId: string;
  watched: boolean;
};

export function notifyWatchlistChanged(restaurantId: string, watched: boolean) {
  window.dispatchEvent(
    new CustomEvent<WatchlistChangedDetail>(WATCHLIST_CHANGED_EVENT, {
      detail: { restaurantId, watched },
    }),
  );
}

/** Overlay in-flight or failed optimistic toggles on server-provided watched state. */
export function resolveWatchedState(
  restaurantId: string | null | undefined,
  serverWatched = false,
  optimistic: Record<string, boolean>,
): boolean {
  if (!restaurantId) return serverWatched;
  const pending = optimistic[restaurantId];
  return pending !== undefined ? pending : serverWatched;
}
