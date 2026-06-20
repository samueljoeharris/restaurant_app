import { useEffect, type ReactNode } from "react";

import { useCollapsiblePanel } from "../hooks/useCollapsiblePanel";
import { cn } from "../lib/cn";

interface MapSearchSidebarProps {
  resultCount: number;
  search: ReactNode;
  children: ReactNode;
  onCollapsedChange?: (collapsed: boolean) => void;
}

/** Fixed left panel for search, filters, and results (desktop pilot). */
export function MapSearchSidebar({
  resultCount,
  search,
  children,
  onCollapsedChange,
}: MapSearchSidebarProps) {
  const { collapsed, toggle } = useCollapsiblePanel("(max-width: 80rem)");
  const countLabel = `${resultCount} ${resultCount === 1 ? "place" : "places"}`;

  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  return (
    <aside
      id="map-search-sidebar"
      className="absolute top-0 bottom-0 left-0 z-[4] flex w-[min(24rem,30vw)] flex-col border-r border-border bg-surface shadow-sm"
      aria-label="Search restaurants"
    >
      <div className="shrink-0 border-b border-border px-4 pt-4 pb-3">
        <div className="[&_.place-search]:mb-0">{search}</div>
        <header className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="m-0 text-lg tracking-tight">Explore</h2>
            <p className="mt-1 text-sm text-text-muted">{countLabel}</p>
          </div>
          <button
            type="button"
            className="h-8 w-8 shrink-0 cursor-pointer rounded-sm border border-border bg-bg p-0 text-xl leading-none text-text-muted hover:border-border-strong hover:text-text"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls="map-search-sidebar-results"
            aria-label={collapsed ? "Expand explore results" : "Collapse explore results"}
            title={collapsed ? "Expand explore results" : "Collapse explore results"}
          >
            <span aria-hidden>{collapsed ? "›" : "‹"}</span>
          </button>
        </header>
      </div>

      <div
        id="map-search-sidebar-results"
        className={cn(
          "min-h-0 flex-1 overflow-y-auto p-4 [&_.place-search]:mb-3",
          collapsed && "hidden",
        )}
        aria-hidden={collapsed}
      >
        {children}
      </div>
    </aside>
  );
}
