import { useState, type ReactNode } from "react";

interface MapSearchSidebarProps {
  /** Count shown on the mobile drag handle. */
  resultCount: number;
  children: ReactNode;
}

/**
 * Overlay shell for search + filters + results on top of the map.
 *
 * - Desktop (≥768px): a fixed left panel, always open.
 * - Mobile: a bottom sheet with a drag handle; collapsed to a peek by default
 *   and expanded on tap so the map stays usable.
 */
export function MapSearchSidebar({ resultCount, children }: MapSearchSidebarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={`map-sidebar${expanded ? " map-sidebar--expanded" : ""}`}
      aria-label="Search restaurants"
    >
      <button
        type="button"
        className="map-sidebar__handle"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="map-sidebar__grip" aria-hidden />
        <span className="map-sidebar__handle-label">
          {resultCount} {resultCount === 1 ? "place" : "places"}
        </span>
        <span className="map-sidebar__handle-action">
          {expanded ? "Hide list" : "Show list"}
        </span>
      </button>
      <div className="map-sidebar__body">{children}</div>
    </aside>
  );
}
