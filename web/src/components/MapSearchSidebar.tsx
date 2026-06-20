import { useEffect, type ReactNode } from "react";

import { useCollapsiblePanel } from "../hooks/useCollapsiblePanel";
import { cn } from "../lib/cn";

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
          className="absolute top-4 left-4 z-[8] inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-2 font-[inherit] text-sm font-semibold text-text shadow-md hover:border-brand"
          onClick={toggle}
          aria-expanded={false}
          aria-controls="map-search-sidebar"
        >
          <span>Explore</span>
          <span
            className="grid min-w-5 place-items-center rounded-full bg-brand px-[0.3rem] text-[0.65rem] font-bold text-text-inverse"
            aria-label={countLabel}
          >
            {resultCount}
          </span>
        </button>
      )}

      <aside
        id="map-search-sidebar"
        className={cn(
          "absolute top-0 bottom-0 left-0 z-[4] flex w-[min(24rem,30vw)] flex-col border-r border-border bg-surface shadow-sm transition-[transform,opacity] duration-normal ease-out",
          collapsed && "pointer-events-none -translate-x-full opacity-0",
        )}
        aria-label="Search restaurants"
        aria-hidden={collapsed}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="m-0 text-lg tracking-tight">Explore</h2>
            <p className="mt-1 text-sm text-text-muted">{countLabel}</p>
          </div>
          <button
            type="button"
            className="h-8 w-8 shrink-0 cursor-pointer rounded-sm border border-border bg-bg p-0 text-xl leading-none text-text-muted hover:border-border-strong hover:text-text"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label="Collapse explore panel"
            title="Collapse explore panel"
          >
            <span aria-hidden>‹</span>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 [&_.place-search]:mb-3">{children}</div>
      </aside>
    </>
  );
}
