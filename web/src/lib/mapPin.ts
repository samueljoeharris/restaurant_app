import type { RestaurantMapEntry } from "../types";
import {
  formatTtfMedian,
  ttfTier,
  TTF_TIER_COLORS,
  TTF_TIER_LABELS,
  type TtfTier,
} from "./ttfTier";

/** Map pin colors — generated from design tokens (light values). */
export const SEARCH_FOCUS_PIN_COLOR = "#3FA7D6";

export type MapPinKind = "confirmed_ttf" | "early_ttf" | "empty";

export function mapPinKind(entry: RestaurantMapEntry): MapPinKind {
  if (entry.ttf.sample_size >= 3) return "confirmed_ttf";
  if (entry.ttf.sample_size > 0) return "early_ttf";
  return "empty";
}

/** Tier color even for 1–2 TTF samples (preview before confidence threshold). */
export function previewTtfTier(entry: RestaurantMapEntry): TtfTier {
  const median = entry.ttf.median_minutes;
  if (entry.ttf.sample_size === 0 || median === null) return "unknown";
  if (median <= 8) return "fast";
  if (median <= 15) return "ok";
  return "slow";
}

export function mapPinFill(entry: RestaurantMapEntry, opts?: { searchFocus?: boolean }): string {
  if (opts?.searchFocus) return SEARCH_FOCUS_PIN_COLOR;
  const kind = mapPinKind(entry);
  if (kind === "confirmed_ttf") {
    return TTF_TIER_COLORS[ttfTier(entry.ttf)];
  }
  if (kind === "early_ttf") {
    return TTF_TIER_COLORS[previewTtfTier(entry)];
  }
  return TTF_TIER_COLORS.unknown;
}

export function mapPinLabel(entry: RestaurantMapEntry): string | null {
  if (entry.ttf.sample_size > 0 && entry.ttf.median_minutes !== null) {
    return `${Math.round(entry.ttf.median_minutes)}m`;
  }
  if (entry.attribute_rating_count > 0) return "★";
  if (entry.note_count > 0) return "💬";
  return null;
}

export function mapPinTooltip(entry: RestaurantMapEntry): string {
  const lines = [entry.name];

  if (entry.ttf.sample_size >= 3) {
    lines.push(
      `Speed: ${formatTtfMedian(entry.ttf)} median (${entry.ttf.sample_size} visits) — ${TTF_TIER_LABELS[ttfTier(entry.ttf)]}`,
    );
  } else if (entry.ttf.sample_size > 0) {
    lines.push(
      `Speed: ${formatTtfMedian(entry.ttf)} from ${entry.ttf.sample_size} visit${entry.ttf.sample_size === 1 ? "" : "s"} (need 3 for tier)`,
    );
  } else {
    lines.push("Speed: no visits logged yet");
  }

  if (entry.attribute_rating_count > 0) {
    lines.push(`Parent ratings: ${entry.attribute_rating_count} submission${entry.attribute_rating_count === 1 ? "" : "s"}`);
  }
  if (entry.note_count > 0) {
    lines.push(`Parent notes: ${entry.note_count}`);
  }
  if (
    entry.ttf.sample_size === 0 &&
    entry.attribute_rating_count === 0 &&
    entry.note_count === 0
  ) {
    lines.push("Be the first parent to contribute");
  }

  return lines.join("\n");
}

/**
 * Which supplementary badges to render alongside the pin label. A badge is
 * suppressed when `mapPinLabel()` already conveys that same signal (e.g. the
 * ★ label on a pin with no TTF data yet), so parents don't see the same icon
 * twice. Mirrors `mapPinLabel()`'s priority: TTF minutes > ratings > notes.
 */
export function mapPinBadges(entry: RestaurantMapEntry): { ratings: boolean; notes: boolean } {
  const labelIsTtf = entry.ttf.sample_size > 0 && entry.ttf.median_minutes !== null;
  const labelIsRatings = !labelIsTtf && entry.attribute_rating_count > 0;
  const labelIsNotes = !labelIsTtf && !labelIsRatings && entry.note_count > 0;
  return {
    ratings: entry.attribute_rating_count > 0 && !labelIsRatings,
    notes: entry.note_count > 0 && !labelIsNotes,
  };
}

export function mapPinHasBadges(entry: RestaurantMapEntry): boolean {
  const { ratings, notes } = mapPinBadges(entry);
  return ratings || notes;
}
