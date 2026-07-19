import { Link, useLocation } from "react-router-dom";

import { useActivityBadge } from "../hooks/useActivityBadge";
import { APP_NAV_TABS, isNavActive } from "../lib/appNav";
import { cn } from "../lib/cn";
import { Z } from "../lib/overlayStack";
import { ActivityInbox } from "./ActivityInbox";
import { ScoutLogo } from "./ScoutLogo";
import { Button, ButtonLink } from "./ui/Button";

export function AppSidebar({
  collapsed,
  onToggleCollapsed,
  onLogout,
  signedIn = true,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onLogout: () => void;
  /** Anonymous visitors (#72) see "Sign in" here instead of "Sign out". */
  signedIn?: boolean;
}) {
  const { pathname } = useLocation();
  const { unreadCount } = useActivityBadge();

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col overflow-visible border-r border-border bg-surface transition-[width] duration-normal ease-out",
        collapsed
          ? "w-[var(--app-sidebar-width-collapsed)]"
          : "w-[var(--app-sidebar-width)]",
      )}
      style={{ zIndex: Z.sidebar }}
      aria-label="App navigation"
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border px-3 pt-5 pb-4",
          collapsed && "flex-col items-center px-2",
        )}
      >
        <Link
          to="/map"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3",
            collapsed && "justify-center",
          )}
        >
          <ScoutLogo className="h-10 w-10 shrink-0 rounded-md" />
          <span
            className={cn(
              "grid min-w-0 gap-0.5 overflow-hidden transition-opacity duration-fast ease-out",
              collapsed && "hidden",
            )}
          >
            <span className="text-base font-extrabold leading-tight tracking-tight">
              Little Scout
            </span>
            <span className="text-xs font-medium text-text-muted">Kid-food speed</span>
          </span>
        </Link>
        {!collapsed && <ActivityInbox />}
        <button
          type="button"
          className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-border bg-bg p-0 text-[1.1rem] leading-none text-text-muted transition-[color,border-color] duration-fast ease-out hover:border-border-strong hover:text-text"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <span aria-hidden>{collapsed ? "›" : "‹"}</span>
        </button>
      </div>

      <nav
        className={cn(
          "flex flex-1 flex-col gap-1 p-4 px-3",
          collapsed && "px-2",
        )}
        aria-label="Main"
      >
        {APP_NAV_TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            viewTransition
            className={cn(
              "flex items-center gap-3 rounded-md p-3 text-sm font-semibold text-text-muted transition-[color,background] duration-fast ease-out hover:bg-bg hover:text-text",
              isNavActive(pathname, tab.to) && "bg-brand-soft text-brand",
              collapsed && "justify-center px-2",
            )}
            title={collapsed ? tab.label : undefined}
            aria-label={collapsed ? tab.label : undefined}
          >
            <span className="relative w-6 shrink-0 text-center text-[1.1rem] leading-none" aria-hidden>
              {tab.icon}
              {tab.to === "/saved" && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-brand" />
              )}
            </span>
            <span className={cn("flex-1 overflow-hidden whitespace-nowrap", collapsed && "hidden")}>
              {tab.label}
              {tab.to === "/saved" && unreadCount > 0 && !collapsed && (
                <span className="ml-2 text-xs text-brand">({unreadCount})</span>
              )}
            </span>
          </Link>
        ))}
      </nav>

      <div className={cn("border-t border-border p-4 px-3", collapsed && "px-2")}>
        {signedIn ? (
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            className={cn(collapsed && "justify-center px-2")}
            onClick={onLogout}
            title={collapsed ? "Sign out" : undefined}
            aria-label="Sign out"
          >
            {collapsed ? <span aria-hidden>🚪</span> : "Sign out"}
          </Button>
        ) : (
          <ButtonLink
            to="/login"
            variant="ghost"
            size="sm"
            fullWidth
            className={cn(collapsed && "justify-center px-2")}
            title={collapsed ? "Sign in" : undefined}
            aria-label="Sign in"
          >
            {collapsed ? <span aria-hidden>🔑</span> : "Sign in"}
          </ButtonLink>
        )}
      </div>
    </aside>
  );
}
