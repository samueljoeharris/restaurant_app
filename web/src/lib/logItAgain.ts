import { api } from "../api/client";
import type { TtfSubmission, UserContribution, UserTtfContribution } from "../types";

/**
 * "Log it again" prefill (#87): starting values for a fresh visit at a
 * restaurant the user has contributed to before. Never includes the TTF
 * timer minutes or note text — those start empty every time.
 */
export interface TtfLogAgainPrefill {
  partySizeKids?: number;
  itemType?: TtfSubmission["item_type"];
  portionSize?: TtfSubmission["portion_size"];
  waitContext?: string;
  ratings: Record<string, boolean | number | string>;
}

/**
 * Builds prefill from a restaurant's contributions (already ordered
 * `submitted_at DESC` by the API). The most recent TTF contribution supplies
 * party size / item type / portion / context; every attribute contribution
 * contributes its most recent value, keyed by metric.
 */
export function buildLogAgainPrefill(items: UserContribution[]): TtfLogAgainPrefill {
  const latestTtf = items.find((item): item is UserTtfContribution => item.kind === "ttf");
  const ratings: Record<string, boolean | number | string> = {};
  for (const item of items) {
    if (item.kind === "attribute" && !(item.metric_key in ratings)) {
      ratings[item.metric_key] = item.value;
    }
  }
  return {
    partySizeKids: latestTtf?.party_size_kids,
    itemType: latestTtf?.item_type,
    portionSize: latestTtf?.portion_size,
    waitContext: latestTtf?.wait_context ?? undefined,
    ratings,
  };
}

/** Fetches a restaurant's contributions for this user and builds the prefill. */
export async function fetchLogAgainPrefill(
  idToken: string,
  restaurantId: string,
): Promise<TtfLogAgainPrefill> {
  const res = await api.listMyContributions(idToken, { restaurant_id: restaurantId, limit: 100 });
  return buildLogAgainPrefill(res.items);
}
