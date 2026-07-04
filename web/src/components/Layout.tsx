import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { useActivityBadge } from "../hooks/useActivityBadge";
import { useCollapsiblePanel } from "../hooks/useCollapsiblePanel";
import { useIsMobile } from "../hooks/useBreakpoint";
import { cn } from "../lib/cn";
import { AppBottomNav } from "./AppBottomNav";
import { AppSidebar } from "./AppSidebar";
import { MobileAppHeader } from "./MobileAppHeader";
import { Skeleton } from "./ui/Skeleton";

function isContributionRoute(pathname: string) {
  return (
    pathname.includes("/submit") ||
    pathname.includes("/rate") ||
    pathname.includes("/review")
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  useActivityBadge();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { collapsed: navCollapsed, toggle: toggleNavCollapsed } = useCollapsiblePanel(
    "(max-width: 87.5rem)",
  );
  const hideNav = isContributionRoute(location.pathname);
  const isMap = location.pathname === "/map" || location.pathname === "/restaurants";
  const showBottomNav = isMobile && !hideNav && !isMap;

  if (loading) {
    return (
      <div className="flex min-h-screen min-w-0 flex-col md:min-w-[var(--desktop-min-width)]">
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <div className="grid w-full flex-1 gap-3 px-4 py-6 md:px-8">
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
        "flex min-h-screen min-w-0 flex-col md:min-w-[var(--desktop-min-width)] md:flex-row md:items-stretch",
        hideNav && "flex-col",
        isMap && (isMobile ? "h-[100dvh] overscroll-none" : "h-screen"),
      )}
    >
      {!hideNav && (
        <>
          {!isMobile && (
            <AppSidebar
              collapsed={navCollapsed}
              onToggleCollapsed={toggleNavCollapsed}
              onLogout={() => logout()}
            />
          )}
          {isMobile && !isMap && <MobileAppHeader />}
        </>
      )}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          hideNav && "w-full",
          isMap && "h-full min-h-0",
          showBottomNav &&
            "pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))]",
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
      {showBottomNav && <AppBottomNav />}
    </div>
  );
}
