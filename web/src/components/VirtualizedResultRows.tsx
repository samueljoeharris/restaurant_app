import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { ResultRow } from "../lib/resultVirtualization";

const CARD_ESTIMATE_PX = 76;
const HEADER_ESTIMATE_PX = 44;

interface VirtualizedResultRowsProps {
  rows: ResultRow[];
  /** The actual scrolling element (MapSearchSidebar's results container) — the
   * virtualizer reads its scroll position instead of owning its own scroll. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Currently map-selected restaurant key, if any — kept scrolled into view. */
  selectedId: string | null;
  renderRow: (row: ResultRow) => ReactNode;
}

/**
 * Windowed rendering for the explore sidebar result list (#81).
 *
 * Only mounted once `shouldVirtualizeResults` clears the row-count threshold;
 * small lists keep rendering the plain markup in ExploreMapPage. Renders
 * inside the sidebar's existing scrollable container (passed via `scrollRef`)
 * rather than introducing a nested scroll region, so `scrollMargin` accounts
 * for the filter bar / summary text rendered above the list in that same
 * container.
 */
export function VirtualizedResultRows({
  rows,
  scrollRef,
  selectedId,
  renderRow,
}: VirtualizedResultRowsProps) {
  const listStartRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (rows[index]?.type === "header" ? HEADER_ESTIMATE_PX : CARD_ESTIMATE_PX),
    overscan: 8,
    scrollMargin: listStartRef.current?.offsetTop ?? 0,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  // Keep the map-selected card in view — the non-virtualized list does this
  // with a ref + scrollIntoView, but a virtualized row's DOM node doesn't
  // exist until it's rendered, so we scroll by index instead.
  useEffect(() => {
    if (!selectedId) return;
    const index = rows.findIndex((row) => row.type === "card" && row.key === selectedId);
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: "auto" });
    }
    // Only re-run when the selection changes, matching the ref-based version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div ref={listStartRef} role="list" style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative", height: virtualizer.getTotalSize(), width: "100%" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;
          return (
            <div
              key={row.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              role={row.type === "card" ? "listitem" : undefined}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              {renderRow(row)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
