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
          <path
            fill="currentColor"
            d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm8.94 3h-2.09a7.01 7.01 0 0 0-1.24-3.01l1.48-1.48a1 1 0 0 0-1.42-1.42l-1.48 1.48A7.01 7.01 0 0 0 15 4.15V2.06a1 1 0 1 0-2 0v2.09a7.01 7.01 0 0 0-3.01 1.24L8.51 3.91a1 1 0 0 0-1.42 1.42l1.48 1.48A7.01 7.01 0 0 0 5.15 11H3.06a1 1 0 1 0 0 2h2.09a7.01 7.01 0 0 0 1.24 3.01l-1.48 1.48a1 1 0 1 0 1.42 1.42l1.48-1.48a7.01 7.01 0 0 0 3.01 1.24v2.09a1 1 0 1 0 2 0v-2.09a7.01 7.01 0 0 0 3.01-1.24l1.48 1.48a1 1 0 0 0 1.42-1.42l-1.48-1.48A7.01 7.01 0 0 0 18.85 13h2.09a1 1 0 1 0 0-2Z"
          />
        </svg>
      )}
    </button>
  );
}
