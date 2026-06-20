import { useCallback, useLayoutEffect, useState } from "react";

import { clampFixedLeft } from "../lib/overlayStack";

export type FixedOverlayStyle = {
  top: number;
  left: number;
  width: number;
};

type Options = {
  /** Max width when not using anchor width. */
  maxWidth?: number;
  /** When true, panel width matches anchor element width. */
  matchAnchorWidth?: boolean;
  gap?: number;
};

export function useFixedOverlayPosition(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  { maxWidth = 352, matchAnchorWidth = false, gap = 8 }: Options = {},
) {
  const [style, setStyle] = useState<FixedOverlayStyle>({ top: 0, left: 0, width: maxWidth });

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = matchAnchorWidth
      ? rect.width
      : Math.min(maxWidth, window.innerWidth - 16);
    setStyle({
      top: rect.bottom + gap,
      left: clampFixedLeft(rect.left, width),
      width,
    });
  }, [anchorRef, gap, matchAnchorWidth, maxWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return style;
}
