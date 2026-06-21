import { useMediaQuery } from "./useMediaQuery";

/** Matches design token --breakpoint-mobile (768px). */
export const MOBILE_MEDIA_QUERY = "(max-width: 47.9375rem)";

export function useIsMobile() {
  return useMediaQuery(MOBILE_MEDIA_QUERY);
}

export function useIsDesktop() {
  return useMediaQuery("(min-width: 48rem)");
}
