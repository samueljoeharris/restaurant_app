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
      className={`map-locate-fab${active ? " map-locate-fab--active" : ""}`}
      onClick={onClick}
      disabled={busy}
      aria-label={busy ? "Finding your location" : "Use my location"}
      title="Use my location"
    >
      {busy ? (
        <span className="map-locate-fab__spinner" aria-hidden="true" />
      ) : (
        <svg
          className="map-locate-fab__icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          fill="none"
        >
          {/* Bullseye — standard “my location” affordance (Google Maps / Apple Maps). */}
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}
