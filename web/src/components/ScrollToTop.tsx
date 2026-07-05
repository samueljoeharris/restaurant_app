import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Reset window scroll when navigating to a new page, like a native browser
 * load would. Back/forward (POP) is left to the browser's own scroll
 * restoration. Only the pathname matters — query-param changes (map filters,
 * search) keep the current position. Uses "instant" so the global
 * `scroll-behavior: smooth` doesn't animate page entries.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== "POP") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname, navigationType]);

  return null;
}
