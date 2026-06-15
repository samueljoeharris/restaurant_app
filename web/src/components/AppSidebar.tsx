import { Link, useLocation } from "react-router-dom";

import { Button } from "./ui/Button";

const tabs = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/map", label: "Explore", icon: "🗺️" },
  { to: "/account", label: "You", icon: "👤" },
] as const;

export function AppSidebar({ onLogout }: { onLogout: () => void }) {
  const { pathname } = useLocation();

  function isActive(path: string) {
    if (path === "/") return pathname === "/";
    if (path === "/map") {
      return pathname === "/map" || pathname === "/restaurants";
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  return (
    <aside className="app-sidebar" aria-label="App navigation">
      <Link to="/" className="app-sidebar__brand">
        <span className="app-sidebar__brand-mark" aria-hidden>
          🔭
        </span>
        <span className="app-sidebar__brand-text">
          <span className="app-sidebar__brand-name">Little Scout</span>
          <span className="app-sidebar__brand-tagline">Kid-food speed</span>
        </span>
      </Link>

      <nav className="app-sidebar__nav" aria-label="Main">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className={[
              "app-sidebar__link",
              isActive(tab.to) ? "app-sidebar__link--active" : "",
            ].join(" ")}
          >
            <span className="app-sidebar__link-icon" aria-hidden>
              {tab.icon}
            </span>
            <span className="app-sidebar__link-label">{tab.label}</span>
          </Link>
        ))}
      </nav>

      <div className="app-sidebar__footer">
        <Button variant="ghost" size="sm" fullWidth onClick={onLogout}>
          Sign out
        </Button>
      </div>
    </aside>
  );
}
