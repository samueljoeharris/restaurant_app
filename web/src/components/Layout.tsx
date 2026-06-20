import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { useActivityBadge } from "../hooks/useActivityBadge";
import { useCollapsiblePanel } from "../hooks/useCollapsiblePanel";
import { cn } from "../lib/cn";
import { AppBottomNav } from "./AppBottomNav";
import { AppSidebar } from "./AppSidebar";
import { MobileAppHeader } from "./MobileAppHeader";
import { Skeleton } from "./ui/Skeleton";

export function Layout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  useActivityBadge();
  const location = useLocation();
  const { collapsed: navCollapsed, toggle: toggleNavCollapsed } = useCollapsiblePanel(
    "(max-width: 87.5rem)",
  );
  const hideNav = location.pathname.includes("/submit");
  const isMap = location.pathname === "/map" || location.pathname === "/restaurants";

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col lg:min-w-[var(--desktop-min-width)]">
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <div className="grid w-full flex-1 gap-3 px-4 py-6 lg:px-8">
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
        "flex min-h-screen flex-col lg:min-w-[var(--desktop-min-width)] lg:flex-row lg:items-stretch",
        hideNav && "lg:flex-col",
        isMap && "h-[100dvh] lg:h-screen",
      )}
    >
      {!hideNav && (
        <>
          <div className="hidden lg:block">
            <AppSidebar
              collapsed={navCollapsed}
              onToggleCollapsed={toggleNavCollapsed}
              onLogout={() => logout()}
            />
          </div>
          {!isMap && <MobileAppHeader />}
        </>
      )}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          hideNav && "w-full",
          isMap && "min-h-0 flex-1",
          !hideNav && "pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0",
        )}
      >
        <main
          className={cn(
            "w-full flex-1",
            isMap && "min-h-0 overflow-hidden p-0",
          )}
        >
          {children}
        </main>
      </div>
      {!hideNav && <AppBottomNav />}
    </div>
  );
}
