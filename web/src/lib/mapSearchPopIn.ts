/** Pin pop-in animation duration (ms) — keep in sync with components.css. */
export const MAP_PIN_POP_IN_MS = 480;

export function schedulePopInClear(
  keys: string[],
  clear: (keys: string[]) => void,
): ReturnType<typeof setTimeout> {
  return setTimeout(() => clear(keys), MAP_PIN_POP_IN_MS + 40);
}
