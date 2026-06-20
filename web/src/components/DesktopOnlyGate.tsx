import type { ReactNode } from "react";

import { cn } from "../lib/cn";

/** Pilot web is desktop-first; mobile layout comes later. */
export function DesktopOnlyGate({ children }: { children: ReactNode }) {
  return (
    <>
      <div
        className={cn(
          "hidden",
          "max-[1023px]:fixed max-[1023px]:inset-0 max-[1023px]:z-[10000] max-[1023px]:grid max-[1023px]:place-items-center max-[1023px]:p-6",
          "max-[1023px]:bg-[radial-gradient(circle_at_20%_0%,color-mix(in_srgb,var(--color-brand)_14%,transparent),transparent_40%),var(--color-bg)]",
        )}
        role="status"
      >
        <div className="max-w-sm rounded-xl border border-border bg-surface p-8 text-center shadow-lg">
          <p className="m-0 mb-2 text-xs font-bold tracking-[0.08em] text-accent uppercase">
            Little Scout
          </p>
          <h1 className="m-0 mb-3 text-2xl">Desktop browser recommended</h1>
          <p className="m-0 leading-normal text-text-muted">
            The web pilot is optimized for laptop and desktop screens right now. Widen your
            window or open Little Scout on a computer to explore the map and search.
          </p>
        </div>
      </div>
      <div className="contents max-[1023px]:hidden">{children}</div>
    </>
  );
}
