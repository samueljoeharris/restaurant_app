import { type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { cn } from "../lib/cn";

type TabId = "community" | "contribute";

interface RestaurantDetailTabsProps {
  defaultTab: TabId;
  community: ReactNode;
  contribute: ReactNode;
}

export function RestaurantDetailTabs({
  defaultTab,
  community,
  contribute,
}: RestaurantDetailTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const active: TabId = tabParam === "contribute" || tabParam === "community" ? tabParam : defaultTab;

  function selectTab(next: TabId) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  return (
    <div>
      <div role="tablist" aria-label="Restaurant sections" className="mb-4 flex gap-4 border-b border-border">
        {(["community", "contribute"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active === tab}
            className={cn(
              "-mb-px border-b-2 px-1 pb-2 text-sm font-bold capitalize transition-colors",
              active === tab
                ? "border-brand text-brand"
                : "border-transparent text-text-muted hover:text-text",
            )}
            onClick={() => selectTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div role="tabpanel">{active === "community" ? community : contribute}</div>
    </div>
  );
}
