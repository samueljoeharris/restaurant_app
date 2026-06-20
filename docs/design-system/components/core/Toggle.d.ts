import React from "react";

export interface ToggleProps {
  /** @default false */
  checked?: boolean;
  onChange?: (next: boolean) => void;
  /** Optional trailing label. */
  label?: string;
  style?: React.CSSProperties;
}

/** Pill switch — sky track when on. */
export function Toggle(props: ToggleProps): JSX.Element;
