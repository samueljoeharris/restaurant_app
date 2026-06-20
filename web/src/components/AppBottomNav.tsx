import { Link, useLocation } from "react-router-dom";

import { useActivityBadge } from "../hooks/useActivityBadge";
import { cn } from "../lib/cn";
import { Z } from "../lib/overlayStack";

const tabs = [
  { to: "/map", label: "Explore", icon: "🗺️" },
  { to: "/saved", label: "Saved", icon: "💛" },
  { to: "/account", label: "You", icon: "🙂" },
] as const;

/** Mobile bottom tab bar — design kit BottomNav pattern (Explore / Saved / You). */
export function AppBottomNav() {
  const { pathname } = useLocation();
  const { unreadCount } = useActivityBadge();

  function isActive(path: string) {
    if (path === "/map") {
      return pathname === "/map" || pathname === "/restaurants" || pathname.startsWith("/restaurants/");
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 border-t border-border bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
      style={{ zIndex: Z.sidebar }}
      aria-label="App navigation"
    >
      <div className="flex px-1.5">
        {tabs.map((tab) => {
          const active = isActive(tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-bold font-display transition-colors duration-fast",
                active ? "text-brand" : "text-text-muted",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative text-base leading-none" aria-hidden>
                {tab.icon}
                {tab.to === "/saved" && unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-brand" />
                )}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
