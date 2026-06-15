import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { BottomNav } from "./BottomNav";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/Skeleton";

export function Layout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const hideNav = location.pathname.includes("/submit");
  // The combined map + search view renders full-bleed on both routes.
  const isMap = location.pathname === "/map" || location.pathname === "/restaurants";

  if (loading) {
    return (
      <div className="shell shell--no-nav">
        <div className="shell__header">
          <div className="shell__brand">
            <span className="shell__brand-mark">🔭</span>
            Little Scout
          </div>
        </div>
        <div className="shell__main page stack">
          <Skeleton className="ui-skeleton--title" />
          <Skeleton className="ui-skeleton--line" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={`shell${hideNav ? " shell--no-nav" : ""}${isMap ? " shell--map" : ""}`}>
      <header className="shell__header">
        <Link to="/" className="shell__brand">
          <span className="shell__brand-mark">🔭</span>
          Little Scout
        </Link>
        <div className="shell__header-actions">
          <span className="shell__tagline">Kid-food speed</span>
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            Sign out
          </Button>
        </div>
      </header>
      <div className={`shell__main${isMap ? " shell__main--flush" : ""}`}>{children}</div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
