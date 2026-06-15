import { useEffect, type ReactNode } from "react";

import { useCollapsiblePanel } from "../hooks/useCollapsiblePanel";

interface MapSearchSidebarProps {
  resultCount: number;
  children: ReactNode;
  onCollapsedChange?: (collapsed: boolean) => void;
}

/** Fixed left panel for search, filters, and results (desktop pilot). */
export function MapSearchSidebar({
  resultCount,
  children,
  onCollapsedChange,
}: MapSearchSidebarProps) {
  const { collapsed, toggle } = useCollapsiblePanel("(max-width: 80rem)");
  const countLabel = `${resultCount} ${resultCount === 1 ? "place" : "places"}`;

  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  return (
    <>
      {collapsed && (
        <button
          type="button"
          className="map-sidebar__reopen"
          onClick={toggle}
          aria-expanded={false}
          aria-controls="map-search-sidebar"
        >
          <span>Explore</span>
          <span className="map-sidebar__reopen-badge" aria-label={countLabel}>
            {resultCount}
          </span>
        </button>
      )}

      <aside
        id="map-search-sidebar"
        className={`map-sidebar map-sidebar--desktop${collapsed ? " map-sidebar--collapsed" : ""}`}
        aria-label="Search restaurants"
        aria-hidden={collapsed}
      >
        <header className="map-sidebar__head">
          <div className="map-sidebar__head-copy">
            <h2 className="map-sidebar__title">Explore</h2>
            <p className="map-sidebar__count muted small">{countLabel}</p>
          </div>
          <button
            type="button"
            className="map-sidebar__toggle"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label="Collapse explore panel"
            title="Collapse explore panel"
          >
            <span aria-hidden>‹</span>
          </button>
        </header>
        <div className="map-sidebar__body">{children}</div>
      </aside>
    </>
  );
}
