import { Link } from "react-router-dom";

import { ActivityInbox } from "./ActivityInbox";
import { ScoutLogo } from "./ScoutLogo";

/** Compact header for mobile — logo + activity inbox (sidebar holds these on desktop). */
export function MobileAppHeader() {
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3 md:hidden">
      <Link to="/map" className="flex min-w-0 items-center gap-2.5">
        <ScoutLogo className="h-9 w-9 shrink-0 rounded-md" />
        <span className="truncate font-display text-base font-extrabold leading-tight tracking-tight">
          Little Scout
        </span>
      </Link>
      <ActivityInbox />
    </header>
  );
}
