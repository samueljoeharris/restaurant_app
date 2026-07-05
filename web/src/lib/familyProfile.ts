/**
 * Family profile v2 vocabularies (#85).
 *
 * Keys mirror the API vocabulary in `api/ttf_api/family_profile.py` — the API
 * validates them, the web renders the labels. This data is private to the
 * account and only travels through the authenticated /v1/me/profile endpoint.
 */

export interface FamilyProfileOption {
  key: string;
  label: string;
}

export const ALLERGEN_OPTIONS: FamilyProfileOption[] = [
  { key: "peanut", label: "Peanut" },
  { key: "tree_nut", label: "Tree nut" },
  { key: "dairy", label: "Dairy" },
  { key: "egg", label: "Egg" },
  { key: "gluten_wheat", label: "Gluten / wheat" },
  { key: "soy", label: "Soy" },
  { key: "shellfish", label: "Shellfish" },
  { key: "fish", label: "Fish" },
  { key: "sesame", label: "Sesame" },
];

export const DIETARY_RESTRICTION_OPTIONS: FamilyProfileOption[] = [
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "pescatarian", label: "Pescatarian" },
  { key: "gluten_free", label: "Gluten-free" },
  { key: "dairy_free", label: "Dairy-free" },
  { key: "nut_free", label: "Nut-free" },
  { key: "halal", label: "Halal" },
  { key: "kosher", label: "Kosher" },
];

export const ATMOSPHERE_OPTIONS: FamilyProfileOption[] = [
  { key: "booth_seating", label: "Booth seating" },
  { key: "outdoor_seating", label: "Outdoor seating" },
  { key: "quiet_preferred", label: "Quieter spots" },
  { key: "roomy_tables", label: "Roomy tables" },
  { key: "stroller_space", label: "Stroller space" },
  { key: "booster_seats", label: "Booster seats" },
  { key: "quick_service", label: "Quick service" },
];

/** Toggle `key` in `list`, preserving option order for stable saves. */
export function toggleKey(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}
