import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export function Layout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="shell">
        <p className="muted center">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="shell">
      <nav className="topnav">
        <Link to="/restaurants" className="brand">
          TTF
        </Link>
        <span className="muted">{user.email}</span>
        <button type="button" className="linkish" onClick={() => logout()}>
          Sign out
        </button>
      </nav>
      {children}
    </div>
  );
}
