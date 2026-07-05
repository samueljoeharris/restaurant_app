import { Link, useLocation } from "react-router-dom";

import { useActivityBadge } from "../hooks/useActivityBadge";
import { APP_NAV_TABS, isNavActive } from "../lib/appNav";
import { cn } from "../lib/cn";
import { Z } from "../lib/overlayStack";

interface AppBottomNavProps {
  /** In document flow below map chrome (map page). Default: fixed to viewport. */
  embedded?: boolean;
}

/** Mobile bottom tab bar — design kit BottomNav pattern (Explore / Saved / You). */
export function AppBottomNav({ embedded = false }: AppBottomNavProps) {
  const { pathname } = useLocation();
  const { unreadCount } = useActivityBadge();

  return (
    <nav
      className={cn(
        "flex border-t border-border bg-surface px-1.5 pt-2",
        embedded
          ? "relative pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
          : "fixed inset-x-0 bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]",
      )}
      style={embedded ? undefined : { zIndex: Z.bottomNav }}
      aria-label="App navigation"
    >
      {APP_NAV_TABS.map((tab) => {
        const active = isNavActive(pathname, tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 text-[0.625rem] font-bold font-display leading-none transition-colors duration-fast",
              active ? "text-brand" : "text-text-muted",
            )}
            aria-current={active ? "page" : undefined}
          >
            <span
              className={cn(
                "relative rounded-full px-3 py-0.5 text-base leading-none transition-colors duration-fast",
                active && "bg-brand-soft",
              )}
              aria-hidden
            >
              {tab.icon}
              {tab.to === "/saved" && unreadCount > 0 && (
                <span className="absolute top-0 right-1 h-2 w-2 rounded-full bg-brand" />
              )}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
