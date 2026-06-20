import React from "react";

export interface UpdateCardProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  /** Tier dot color. @default "fast" */
  tier?: "fast" | "ok" | "slow" | "none";
  /** Relative time, e.g. "2h". Ignored when isNew. */
  time?: string;
  /** Shows a mango "New" pill instead of time. @default false */
  isNew?: boolean;
  children?: React.ReactNode;
}

/** Feed/home card describing a change on a saved spot. */
export function UpdateCard(props: UpdateCardProps): JSX.Element;
