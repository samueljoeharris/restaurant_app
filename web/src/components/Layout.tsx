import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { useActivityBadge } from "../hooks/useActivityBadge";
import { useCollapsiblePanel } from "../hooks/useCollapsiblePanel";
import { cn } from "../lib/cn";
import { AppSidebar } from "./AppSidebar";
import { Skeleton } from "./ui/Skeleton";

export function Layout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  useActivityBadge();
  const location = useLocation();
  const { collapsed: navCollapsed, toggle: toggleNavCollapsed } = useCollapsiblePanel(
    "(max-width: 87.5rem)",
  );
  const hideNav = location.pathname.includes("/submit");
  // The combined map + search view renders full-bleed on both routes.
  const isMap = location.pathname === "/map" || location.pathname === "/restaurants";

  if (loading) {
    return (
      <div className="flex min-h-screen min-w-[var(--desktop-min-width)] flex-col">
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <div className="grid w-full flex-1 gap-3 px-8 py-6">
            <Skeleton className="h-4 w-[55%]" />
            <Skeleton className="h-3 w-[85%]" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div
      className={cn(
        "flex min-h-screen min-w-[var(--desktop-min-width)] flex-row items-stretch",
        hideNav && "flex-col",
        isMap && "h-screen overflow-hidden",
      )}
    >
      {!hideNav && (
        <AppSidebar
          collapsed={navCollapsed}
          onToggleCollapsed={toggleNavCollapsed}
          onLogout={() => logout()}
        />
      )}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          hideNav && "w-full",
          isMap && "h-full min-h-0",
        )}
      >
        <main
          className={cn(
            "w-full flex-1",
            isMap && "h-full min-h-0 overflow-hidden p-0",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
