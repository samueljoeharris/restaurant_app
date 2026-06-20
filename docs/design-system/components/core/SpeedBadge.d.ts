import React from "react";

export interface SpeedBadgeProps {
  /** Minutes-to-food. Pass null/undefined for "no data". */
  minutes?: number | null;
  /** TTF tier — drives dot + pill color. @default "fast" */
  tier?: "fast" | "ok" | "slow" | "none";
  /** Eyebrow label. @default "Kid food speed" */
  caption?: string;
  /** Sub-line, e.g. "12 visits · 4.2/5 quality". */
  meta?: string;
  style?: React.CSSProperties;
}

/**
 * The flagship kid-food-speed figure. Keep it the loudest thing on a detail page.
 * @startingPoint section="Scout" subtitle="Flagship kid-food-speed badge" viewport="700x150"
 */
export function SpeedBadge(props: SpeedBadgeProps): JSX.Element;
