import { useEffect, useState, type ReactNode } from "react";

import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useCollapsiblePanel } from "../hooks/useCollapsiblePanel";
import { useIsMobile } from "../hooks/useBreakpoint";
import { cn } from "../lib/cn";

interface MapSearchSidebarProps {
  resultCount: number;
  search: ReactNode;
  children: ReactNode;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** When a map pin detail sheet is open, collapse the search sheet on mobile. */
  pinSheetOpen?: boolean;
  /** In-flow footer on mobile map (not an absolute overlay). */
  embedded?: boolean;
}

function SheetHandle({
  onClick,
  label,
  expanded,
}: {
  onClick: () => void;
  label: string;
  expanded: boolean;
}) {
  return (
    <button
      type="button"
      className="flex w-full cursor-pointer flex-col items-center gap-1 border-0 bg-transparent px-4 pt-2 pb-1 font-[inherit]"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={label}
    >
      <span
        className="h-1 w-10 shrink-0 rounded-full bg-border-strong"
        aria-hidden
      />
    </button>
  );
}

/** Desktop left panel or mobile bottom sheet for search, filters, and results. */
export function MapSearchSidebar({
  resultCount,
  search,
  children,
  onCollapsedChange,
  pinSheetOpen = false,
  embedded = false,
}: MapSearchSidebarProps) {
  const isMobile = useIsMobile();
  const { collapsed, toggle } = useCollapsiblePanel("(max-width: 80rem)");
  const [expanded, setExpanded] = useState(false);
  const countLabel = `${resultCount} ${resultCount === 1 ? "place" : "places"}`;
  const sheetExpanded = expanded && !pinSheetOpen;
  const mobileFooter = isMobile && embedded;

  useBodyScrollLock(mobileFooter && sheetExpanded);

  useEffect(() => {
    if (mobileFooter) {
      onCollapsedChange?.(!sheetExpanded);
      return;
    }
    if (isMobile) {
      onCollapsedChange?.(!sheetExpanded);
      return;
    }
    onCollapsedChange?.(collapsed);
  }, [mobileFooter, isMobile, sheetExpanded, collapsed, onCollapsedChange]);

  if (mobileFooter) {
    return (
      <aside
        id="map-search-sidebar"
        className={cn(
          "flex flex-col overflow-hidden bg-surface",
          sheetExpanded && "max-h-[min(58dvh,28rem)] border-b border-border shadow-[0_-8px_24px_rgb(47_58_66_/_10%)]",
        )}
        aria-label="Search restaurants"
      >
        <SheetHandle
          onClick={() => setExpanded((v) => !v)}
          label={sheetExpanded ? "Collapse explore results" : "Expand explore results"}
          expanded={sheetExpanded}
        />

        {sheetExpanded ? (
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 pb-3">
              <div className="min-w-0">
                <h2 className="m-0 text-base tracking-tight">Explore</h2>
                <p className="mt-0.5 text-sm text-text-muted">{countLabel}</p>
              </div>
              <button
                type="button"
                className="min-h-11 shrink-0 cursor-pointer rounded-md border border-border bg-bg px-3 text-sm font-semibold text-brand"
                onClick={() => setExpanded(false)}
                aria-expanded
                aria-controls="map-search-sidebar-results"
              >
                Map
              </button>
            </div>
            <div className="shrink-0 border-b border-border px-4 py-3">
              <div className="[&_.place-search]:mb-0">{search}</div>
            </div>
            <div
              id="map-search-sidebar-results"
              className="min-h-0 flex-1 overflow-y-auto p-4 [&_.place-search]:mb-3"
            >
              {children}
            </div>
          </>
        ) : (
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2">
            <p className="m-0 text-sm font-semibold text-text">{countLabel}</p>
            <button
              type="button"
              className="min-h-11 shrink-0 cursor-pointer rounded-md border border-border bg-bg px-3 text-sm font-semibold text-brand"
              onClick={() => setExpanded(true)}
              aria-expanded={false}
              aria-controls="map-search-sidebar-results"
            >
              List
            </button>
          </div>
        )}
      </aside>
    );
  }

  if (isMobile && !embedded) {
    return null;
  }

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
