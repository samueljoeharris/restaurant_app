import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { api } from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { publicAppHandoffUrl } from "../../auth/handoff";
import { PUBLIC_APP_URL } from "../../buildTarget";
import { cn } from "../../lib/cn";
import { Badge } from "../ui/Badge";

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/moderation", label: "Moderation" },
  { to: "/admin/restaurants", label: "Restaurants" },
  { to: "/admin/users", label: "Contributors" },
  { to: "/admin/data", label: "Data & observations" },
  { to: "/admin/tools/locations", label: "Location seeding" },
  { to: "/admin/account", label: "Security" },
];

const adminActionClass =
  "cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit] text-sm font-semibold text-accent";

export function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, idToken, logout } = useAuth();
  const [publicNavBusy, setPublicNavBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!idToken) return;
    api
      .adminAttention(idToken)
      .then((a) => setPendingCount(a.pending_moderation))
      .catch(() => setPendingCount(0));
  }, [idToken, location.pathname]);

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
    <div className="grid min-h-screen min-w-[var(--desktop-min-width)] grid-cols-[15rem_1fr] bg-bg">
      <aside className="sticky top-0 flex h-screen flex-col gap-4 border-r border-border bg-surface p-5">
        <Link
          to="/admin"
          className="flex items-center gap-2 text-lg font-extrabold tracking-tight"
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-sm bg-brand-soft text-[1.1rem]"
            aria-hidden
          >
            🔭
          </span>
          Little Scout Admin
        </Link>
        <nav className="grid gap-1">
          {NAV.map((item) => {
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center justify-between rounded-sm px-3 py-2 text-sm font-semibold text-text-muted transition-[color,background] duration-fast",
                  active
                    ? "bg-brand-soft text-text"
                    : "hover:bg-brand-soft hover:text-text",
                )}
              >
                <span>{item.label}</span>
                {item.to === "/admin/moderation" && pendingCount > 0 ? (
                  <Badge variant="warning">{pendingCount}</Badge>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-2">
          <p className="m-0 break-all text-xs text-text-muted">{user?.email ?? "Admin"}</p>
          <button
            type="button"
            className={cn(adminActionClass, "disabled:cursor-not-allowed disabled:opacity-55")}
            disabled={publicNavBusy}
            onClick={() => void openPublicApp()}
          >
            {publicNavBusy ? "Opening…" : "← Public app"}
          </button>
          <button type="button" className={adminActionClass} onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="max-w-[var(--page-max-width)] px-8 py-6">{children}</main>
    </div>
  );
}
