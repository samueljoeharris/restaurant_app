import { useState } from "react";

import { usePlacePractical } from "../hooks/usePlacePractical";
import { googleMapsDirectionsUrl, googleMapsUrlForEntry } from "../lib/googleMapsUrl";
import type { RestaurantMapEntry } from "../types";
import { Badge } from "./ui/Badge";
import { ButtonAnchor } from "./ui/Button";
import { SkeletonList } from "./ui/Skeleton";

type PlacePracticalTarget = Pick<
  RestaurantMapEntry,
  "google_place_id" | "google_maps_url" | "lat" | "lng" | "name" | "address"
>;

type PlacePracticalInfoProps = {
  target: PlacePracticalTarget;
  compact?: boolean;
  showWeekdayHours?: boolean;
};

/** Rounded stroke icons (Lucide shapes) for the practical action pills. */
function ActionIcon({ kind }: { kind: "directions" | "call" | "website" }) {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "directions" && <polygon points="3 11 22 2 13 21 11 13 3 11" />}
      {kind === "call" && (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      )}
      {kind === "website" && (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </>
      )}
    </svg>
  );
}

export function PlacePracticalInfo({
  target,
  compact = false,
  showWeekdayHours = false,
}: PlacePracticalInfoProps) {
  const placeId = target.google_place_id ?? null;
  const { data, loading, error } = usePlacePractical(placeId);
  const [hoursExpanded, setHoursExpanded] = useState(false);

  if (!placeId) {
    return null;
  }

  if (loading && !data) {
    return compact ? (
      <p className="m-0 text-sm text-text-muted">Loading hours…</p>
    ) : (
      <SkeletonList count={1} />
    );
  }

  if (error || !data) {
    return null;
  }

  const directionsUrl =
    googleMapsDirectionsUrl(target) ??
    googleMapsUrlForEntry({
      ...target,
      google_maps_url: data.google_maps_url ?? target.google_maps_url,
    });
  const mapsUrl =
    data.google_maps_url ??
    googleMapsUrlForEntry({
      ...target,
      google_maps_url: data.google_maps_url ?? target.google_maps_url,
    });

  const openBadge =
    data.open_now === true ? (
      <Badge variant="success">Open now</Badge>
    ) : data.open_now === false ? (
      <Badge variant="neutral">Closed</Badge>
    ) : null;

  return (
    <section className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      {!compact && (
        <h3 className="m-0 text-xs font-semibold tracking-wide text-text-muted uppercase">
          Hours & directions
        </h3>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {openBadge}
        {data.hours_summary && (
          <p className="m-0 text-sm text-text">{data.hours_summary}</p>
        )}
      </div>

      {data.google_rating != null && (
        <p className="m-0 text-sm text-text-muted">
          Google rating {data.google_rating.toFixed(1)}
          {data.google_rating_count != null ? ` · ${data.google_rating_count} reviews` : ""}
        </p>
      )}

      {showWeekdayHours && data.weekday_hours && data.weekday_hours.length > 0 && (
        <div className="grid gap-2">
          <button
            type="button"
            className="w-fit cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-brand hover:underline"
            onClick={() => setHoursExpanded((prev) => !prev)}
          >
            {hoursExpanded ? "Hide hours" : "See full hours"}
          </button>
          {hoursExpanded && (
            <ul className="m-0 grid list-none gap-1 p-0 text-sm text-text-muted">
              {data.weekday_hours.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {directionsUrl && (
          <ButtonAnchor
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            variant="secondary"
            size={compact ? "sm" : "md"}
            className="rounded-full"
          >
            <ActionIcon kind="directions" />
            Directions
          </ButtonAnchor>
        )}
        {data.phone && (
          <ButtonAnchor
            href={`tel:${data.phone}`}
            variant="secondary"
            size={compact ? "sm" : "md"}
            className="rounded-full"
          >
            <ActionIcon kind="call" />
            Call
          </ButtonAnchor>
        )}
        {data.website && (
          <ButtonAnchor
            href={data.website}
            target="_blank"
            rel="noreferrer"
            variant="secondary"
            size={compact ? "sm" : "md"}
            className="rounded-full"
          >
            <ActionIcon kind="website" />
            Website
          </ButtonAnchor>
        )}
        {mapsUrl && (
          <ButtonAnchor
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            variant="ghost"
            size={compact ? "sm" : "md"}
            className="rounded-full"
          >
            Google Maps
          </ButtonAnchor>
        )}
      </div>

      <p className="m-0 text-xs text-text-muted">Powered by Google</p>
    </section>
  );
}
