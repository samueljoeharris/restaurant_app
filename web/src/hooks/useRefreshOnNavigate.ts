import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Re-run effect when this route is entered again (e.g. after submit → back). */
export function useRefreshOnNavigate(effect: () => void | (() => void), deps: unknown[] = []) {
  const location = useLocation();

  useEffect(() => {
    return effect();
    // location.key changes on every distinct navigation to this route
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, ...deps]);
}
