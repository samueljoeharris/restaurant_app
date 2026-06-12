import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { publicAppHandoffUrl } from "../../auth/handoff";
import { PUBLIC_APP_URL } from "../../buildTarget";

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/restaurants", label: "Restaurants" },
  { to: "/admin/locations", label: "Location seeding" },
  { to: "/admin/users", label: "Contributors" },
  { to: "/admin/observations", label: "Observation log" },
  { to: "/admin/account", label: "Security" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, idToken, logout } = useAuth();
  const [publicNavBusy, setPublicNavBusy] = useState(false);

  async function openPublicApp() {
    if (publicNavBusy) return;
    if (!idToken) {
      window.location.href = PUBLIC_APP_URL;
      return;
    }
    setPublicNavBusy(true);
    try {
      const { custom_token } = await api.authHandoff(idToken);
      window.location.href = publicAppHandoffUrl(PUBLIC_APP_URL, custom_token);
    } catch {
      window.location.href = PUBLIC_APP_URL;
    }
  }

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
          <button
            type="button"
            className="admin-sidebar__back"
            disabled={publicNavBusy}
            onClick={() => void openPublicApp()}
          >
            {publicNavBusy ? "Opening…" : "← Public app"}
          </button>
          <button type="button" className="admin-sidebar__logout" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
