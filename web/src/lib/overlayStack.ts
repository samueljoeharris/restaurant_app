/** Shared z-index scale — modal > toast > dropdown > sidebar chrome. */
export const Z = {
  mapStatus: 6,
  mapFab: 9,
  mapSidebar: 4,
  mapPanel: 3,
  sidebar: 30,
  dropdown: 100,
  toast: 150,
  modal: 200,
  desktopGate: 10000,
} as const;

export function clampFixedLeft(left: number, width: number, margin = 8) {
  const maxLeft = window.innerWidth - width - margin;
  return Math.max(margin, Math.min(left, maxLeft));
}
