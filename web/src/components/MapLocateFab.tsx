import { cn } from "../lib/cn";

interface MapLocateFabProps {
  busy?: boolean;
  active?: boolean;
  onClick: () => void;
}

/** Standard map “my location” control — bottom-right floating action button. */
export function MapLocateFab({ busy, active, onClick }: MapLocateFabProps) {
  return (
    <button
      type="button"
      className={cn(
        "absolute right-4 bottom-4 z-[9] grid h-12 w-12 place-items-center rounded-full border border-border bg-surface p-0 text-text shadow-md transition-[background,color,box-shadow] duration-fast ease-out hover:enabled:shadow-lg disabled:cursor-wait disabled:opacity-70",
        active && "border-2 border-brand text-brand",
      )}
      onClick={onClick}
      disabled={busy}
      aria-label={busy ? "Finding your location" : "Use my location"}
      title="Use my location"
    >
      {busy ? (
        <span className="map-locate-fab__spinner h-5 w-5" aria-hidden="true" />
      ) : (
        <svg
          className="h-[1.35rem] w-[1.35rem]"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          fill="none"
        >
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}
