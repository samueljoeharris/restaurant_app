import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual treatment. @default "primary" */
  variant?: "primary" | "secondary" | "soft" | "ghost";
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}

/**
 * Rounded, friendly action button in the Little Scout brand.
 * @startingPoint section="Core" subtitle="Brand button — primary / secondary / soft / ghost" viewport="700x140"
 */
export function Button(props: ButtonProps): JSX.Element;
