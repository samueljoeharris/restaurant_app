import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/restaurants", label: "Explore", icon: "🔍" },
  { to: "/map", label: "Map", icon: "🗺️" },
  { to: "/account", label: "You", icon: "👤" },
] as const;

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === "/"}
          className={({ isActive }) =>
            ["bottom-nav__item", isActive ? "bottom-nav__item--active" : ""].join(" ")
          }
        >
          <span className="bottom-nav__icon" aria-hidden>
            {tab.icon}
          </span>
          <span className="bottom-nav__label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
