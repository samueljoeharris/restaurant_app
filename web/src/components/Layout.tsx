import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { useCollapsiblePanel } from "../hooks/useCollapsiblePanel";
import { AppSidebar } from "./AppSidebar";
import { Skeleton } from "./ui/Skeleton";

export function Layout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const { collapsed: navCollapsed, toggle: toggleNavCollapsed } = useCollapsiblePanel(
    "(max-width: 87.5rem)",
  );
  const hideNav = location.pathname.includes("/submit");
  // The combined map + search view renders full-bleed on both routes.
  const isMap = location.pathname === "/map" || location.pathname === "/restaurants";

  if (loading) {
    return (
      <div className="shell shell--no-nav">
        <div className="shell__content">
          <div className="shell__main page stack">
            <Skeleton className="ui-skeleton--title" />
            <Skeleton className="ui-skeleton--line" />
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
      className={[
        "shell",
        hideNav ? "shell--no-nav" : "",
        isMap ? "shell--map" : "",
        !hideNav && navCollapsed ? "shell--nav-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!hideNav && (
        <AppSidebar
          collapsed={navCollapsed}
          onToggleCollapsed={toggleNavCollapsed}
          onLogout={() => logout()}
        />
      )}
      <div className="shell__content">
        <main className={`shell__main${isMap ? " shell__main--flush" : ""}`}>{children}</main>
      </div>
    </div>
  );
}
