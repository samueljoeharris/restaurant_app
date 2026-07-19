/** Shared z-index scale — modal > toast > dropdown > map FAB > map sheets > bottom nav > sidebar. */
// Values generated from design/tokens.json zIndex — edit there, then npm run tokens:generate.
export const Z = {
  mapPanel: 3,
  mapSidebar: 4,
  mapStatus: 6,
  mapSheet: 50,
  mapFab: 60,
  sidebar: 30,
  bottomNav: 40,
  dropdown: 100,
  toast: 150,
  modal: 200,
} as const;

export function clampFixedLeft(left: number, width: number, margin = 8) {
  const maxLeft = window.innerWidth - width - margin;
  return Math.max(margin, Math.min(left, maxLeft));
}
