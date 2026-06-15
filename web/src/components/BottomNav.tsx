import { Link, useLocation } from "react-router-dom";

const tabs = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/map", label: "Explore", icon: "🗺️" },
  { to: "/account", label: "You", icon: "👤" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  function isActive(path: string) {
    if (path === "/") return pathname === "/";
    // Explore now spans the combined map + search experience (/map and /restaurants).
    if (path === "/map") return pathname === "/map" || pathname.startsWith("/restaurants");
    return pathname === path;
  }

  return (
    <nav className="bottom-nav" aria-label="Main">
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          className={["bottom-nav__item", isActive(tab.to) ? "bottom-nav__item--active" : ""].join(
            " ",
          )}
        >
          <span className="bottom-nav__icon" aria-hidden>
            {tab.icon}
          </span>
          <span className="bottom-nav__label">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
