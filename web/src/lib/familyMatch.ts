import type { ExtendedUserProfile, FamilyMatchResult } from "../types";

/**
 * Mirrors the API's `has_matchable_preferences` (ttf_api/family_match.py):
 * the "Fits my family" filter is only useful once the account has at least
 * one profile preference set to match against.
 */
export function hasMatchablePreferences(
  profile: Pick<
    ExtendedUserProfile,
    "allergies" | "dietary_restrictions" | "cuisine_likes" | "cuisine_dislikes" | "atmosphere_preferences"
  >,
): boolean {
  return (
    profile.allergies.length > 0 ||
    profile.dietary_restrictions.length > 0 ||
    profile.cuisine_likes.length > 0 ||
    profile.cuisine_dislikes.length > 0 ||
    profile.atmosphere_preferences.length > 0
  );
}

/** Reasons a restaurant matched, or undefined if no match data is loaded yet. */
export function matchReasonsFor(
  matches: Map<string, FamilyMatchResult> | null,
  restaurantId: string | null,
): string[] | undefined {
  if (!matches || !restaurantId) return undefined;
  return matches.get(restaurantId)?.reasons;
}
