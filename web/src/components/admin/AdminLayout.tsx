import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { PUBLIC_APP_URL } from "../../buildTarget";

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/restaurants", label: "Restaurants" },
  { to: "/admin/users", label: "Contributors" },
  { to: "/admin/observations", label: "Observation log" },
  { to: "/admin/account", label: "Security" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/admin" className="admin-sidebar__brand">
          <span className="shell__brand-mark">🔭</span>
          Little Scout Admin
        </Link>
        <nav className="admin-sidebar__nav">
          {NAV.map((item) => {
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  "admin-sidebar__link",
                  active ? "admin-sidebar__link--active" : "",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar__footer">
          <p className="admin-sidebar__user">{user?.email ?? "Admin"}</p>
          <a href={PUBLIC_APP_URL} className="admin-sidebar__back">
            ← Public app
          </a>
          <button type="button" className="admin-sidebar__logout" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
