import type { ReactNode } from "react";

interface MapSearchSidebarProps {
  resultCount: number;
  children: ReactNode;
}

/** Fixed left panel for search, filters, and results (desktop pilot). */
export function MapSearchSidebar({ resultCount, children }: MapSearchSidebarProps) {
  return (
    <aside className="map-sidebar map-sidebar--desktop" aria-label="Search restaurants">
      <header className="map-sidebar__head">
        <h2 className="map-sidebar__title">Explore</h2>
        <p className="map-sidebar__count muted small">
          {resultCount} {resultCount === 1 ? "place" : "places"}
        </p>
      </header>
      <div className="map-sidebar__body">{children}</div>
    </aside>
  );
}
