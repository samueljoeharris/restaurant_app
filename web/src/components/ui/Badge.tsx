import type { ReactNode } from "react";

type Tone = "brand" | "neutral" | "success" | "warning";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={["ui-badge", `ui-badge--${tone}`, className ?? ""].join(" ")}>
      {children}
    </span>
  );
}
