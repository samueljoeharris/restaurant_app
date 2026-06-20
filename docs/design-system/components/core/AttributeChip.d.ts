import React from "react";

export interface AttributeChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string;
  /** Leading glyph/emoji, e.g. "🪑". Optional. */
  icon?: React.ReactNode;
  /** Selected/filter-on state — sky fill. @default false */
  active?: boolean;
  /** Dashed "add more" affordance. @default false */
  dashed?: boolean;
}

/** Rounded parent-attribute / filter pill. */
export function AttributeChip(props: AttributeChipProps): JSX.Element;
