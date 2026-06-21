/** Shared z-index scale — modal > toast > dropdown > map sheets > bottom nav > sidebar. */
export const Z = {
  mapStatus: 6,
  mapFab: 9,
  mapSidebar: 4,
  mapPanel: 3,
  sidebar: 30,
  bottomNav: 40,
  mapSheet: 50,
  dropdown: 100,
  toast: 150,
  modal: 200,
} as const;

export function clampFixedLeft(left: number, width: number, margin = 8) {
  const maxLeft = window.innerWidth - width - margin;
  return Math.max(margin, Math.min(left, maxLeft));
}
