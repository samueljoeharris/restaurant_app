export const APP_NAV_TABS = [
  { to: "/map", label: "Explore", icon: "🗺️" },
  { to: "/saved", label: "Saved", icon: "💛" },
  { to: "/account", label: "You", icon: "🙂" },
] as const;

export function isNavActive(pathname: string, path: string) {
  if (path === "/map") {
    return pathname === "/map" || pathname === "/restaurants";
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}
