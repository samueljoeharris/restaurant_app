import { useCallback, useState } from "react";

import { useMediaQuery } from "./useMediaQuery";

/** Collapsed when the viewport matches `autoCollapseQuery`; manual toggle overrides until toggled again. */
export function useCollapsiblePanel(autoCollapseQuery: string) {
  const autoCollapsed = useMediaQuery(autoCollapseQuery);
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);
  const collapsed = manualOverride ?? autoCollapsed;

  const toggle = useCallback(() => {
    setManualOverride((prev) => {
      const current = prev ?? autoCollapsed;
      return !current;
    });
  }, [autoCollapsed]);

  return { collapsed, toggle };
}
