import React from "react";

export interface BottomNavItem {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export interface BottomNavProps {
  items: BottomNavItem[];
  style?: React.CSSProperties;
}

/** Mobile tab bar — Feed · Explore · Saved · You. */
export function BottomNav(props: BottomNavProps): JSX.Element;
