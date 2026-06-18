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
        >
          {/* Material near_me — matches iOS MapLocateFab `location.fill` */}
          <path
            fill="currentColor"
            d="M12 2 4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"
          />
        </svg>
      )}
    </button>
  );
}
