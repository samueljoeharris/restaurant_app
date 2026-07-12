import type { UserContribution } from "../types";

/**
 * Client-side visit grouping (#86): bundles a user's contributions to the
 * same restaurant into "the visit" they came from, with no schema change.
 * Consecutive contributions (by submitted_at) at the same restaurant within
 * this window are treated as one sitting.
 */
export const VISIT_WINDOW_MS = 90 * 60 * 1000; // 90 minutes

// ponytail(#129): `pending_review` isn't declared on UserContribution's member
// types yet — the /v1/me/contributions API doesn't return it either, only
// submit-response payloads do (web/src/types.ts ContributionSubmitResponse /
// RestaurantNote). Reading it structurally here means the badge below lights
// up correctly the moment the API/types add it, with no grouping-logic
// changes required. Ceiling: once the list endpoint returns it, promote this
// to a real field on UserTtfContribution/UserAttributeContribution/
// UserNoteContribution and drop the cast.
type ContributionWithModeration = UserContribution & { pending_review?: boolean };

export interface ContributionVisit {
  /** Stable across re-fetches: restaurant id + the oldest item in the group. */
  key: string;
  restaurantId: string;
  restaurantName: string;
  /** Most recent contribution's timestamp — used for sorting and display. */
  latestAt: string;
  items: UserContribution[];
  /** True if any contribution in this visit is awaiting moderation. */
  pendingReview: boolean;
}

/**
 * Groups contributions into visits. Input does not need to be pre-sorted;
 * this sorts by restaurant then by time so grouping is order-independent.
 */
export function groupContributionsIntoVisits(items: UserContribution[]): ContributionVisit[] {
  const byRestaurant = new Map<string, UserContribution[]>();
  for (const item of items) {
    const list = byRestaurant.get(item.restaurant_id) ?? [];
    list.push(item);
    byRestaurant.set(item.restaurant_id, list);
  }

  const visits: ContributionVisit[] = [];
  for (const [restaurantId, list] of byRestaurant) {
    const sorted = [...list].sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
    );
    let current: UserContribution[] = [];
    for (const item of sorted) {
      const prev = current[current.length - 1];
      const gapMs = prev
        ? new Date(prev.submitted_at).getTime() - new Date(item.submitted_at).getTime()
        : 0;
      if (prev && gapMs > VISIT_WINDOW_MS) {
        visits.push(toVisit(restaurantId, current));
        current = [item];
      } else {
        current.push(item);
      }
    }
    if (current.length > 0) visits.push(toVisit(restaurantId, current));
  }

  visits.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
  return visits;
}

function toVisit(restaurantId: string, items: UserContribution[]): ContributionVisit {
  const oldest = items[items.length - 1];
  return {
    key: `${restaurantId}:${oldest.id}`,
    restaurantId,
    restaurantName: items[0].restaurant_name,
    latestAt: items[0].submitted_at,
    items,
    pendingReview: items.some(
      (item) => (item as ContributionWithModeration).pending_review === true,
    ),
  };
}
