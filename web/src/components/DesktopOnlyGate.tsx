import type { ReactNode } from "react";

/** Pilot web is desktop-first; mobile layout comes later. */
export function DesktopOnlyGate({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="desktop-only-gate" role="status">
        <div className="desktop-only-gate__card">
          <p className="desktop-only-gate__eyebrow">Little Scout</p>
          <h1 className="desktop-only-gate__title">Desktop browser recommended</h1>
          <p className="desktop-only-gate__body">
            The web pilot is optimized for laptop and desktop screens right now. Widen your
            window or open Little Scout on a computer to explore the map and search.
          </p>
        </div>
      </div>
      <div className="desktop-app">{children}</div>
    </>
  );
}
