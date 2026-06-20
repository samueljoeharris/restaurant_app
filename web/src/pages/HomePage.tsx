import { useMemo } from "react";
import { Link } from "react-router-dom";

import { PlaceSearchBox } from "../components/PlaceSearchBox";
import { ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { usePlaceSearchHandlers } from "../hooks/usePlaceSearchHandlers";
import { useFullRestaurantCatalog } from "../hooks/useRestaurantMapCatalog";
import { cn } from "../lib/cn";
import type { RestaurantMapEntry } from "../types";

type LandingOption = {
  title: string;
  description: string;
  icon: string;
  to: string;
  metric?: string;
};

function hasParentData(restaurant: RestaurantMapEntry) {
  return (
    restaurant.ttf.sample_size > 0 ||
    restaurant.attribute_rating_count > 0 ||
    restaurant.note_count > 0
  );
}

function hasFastStarterData(restaurant: RestaurantMapEntry) {
  return (
    restaurant.ttf.sample_size > 0 &&
    restaurant.ttf.median_minutes !== null &&
    restaurant.ttf.median_minutes <= 10
  );
}

function formatPlaceCount(count: number) {
  return `${count} ${count === 1 ? "place" : "places"}`;
}

export function HomePage() {
  const { handleSelectPlace, handleSelectRestaurant } = usePlaceSearchHandlers();
  const { restaurants, loading, error } = useFullRestaurantCatalog();

  const counts = useMemo(() => {
    const withParentData = restaurants.filter(hasParentData).length;
    const fastStarter = restaurants.filter(hasFastStarterData).length;

    return {
      total: restaurants.length,
      withParentData,
      fastStarter,
      needsData: Math.max(restaurants.length - withParentData, 0),
    };
  }, [restaurants]);

  const options: LandingOption[] = [
    {
      title: "Find a quick kid starter",
      description: "Prioritize places where parents have logged fast fries, bread, or other kid-safe starts.",
      icon: "⏱️",
      to: "/restaurants?filter=fast-starters",
      metric: loading ? undefined : formatPlaceCount(counts.fastStarter),
    },
    {
      title: "Browse parent-rated spots",
      description: "See restaurants with TTF observations, notes, or family-friendly attribute ratings.",
      icon: "⭐",
      to: "/restaurants?filter=parent-data",
      metric: loading ? undefined : formatPlaceCount(counts.withParentData),
    },
    {
      title: "Open the map",
      description: "Scan the area visually and tap into restaurants near your route.",
      icon: "🗺️",
      to: "/map",
      metric: loading ? undefined : `${counts.total} mapped`,
    },
    {
      title: "Help scout a new place",
      description: "Find restaurants that still need a parent observation or note.",
      icon: "🔭",
      to: "/restaurants?filter=needs-data",
      metric: loading ? undefined : `${counts.needsData} to scout`,
    },
  ];

  return (
    <div className="mx-auto grid max-w-[var(--page-max-width)] gap-6 px-8 py-6 animate-page-enter">
      <section
        className={cn(
          "grid gap-4 rounded-xl border border-brand/18 p-6 shadow-sm",
          "bg-[radial-gradient(circle_at_90%_0%,color-mix(in_srgb,var(--color-brand)_16%,transparent),transparent_32%),linear-gradient(135deg,var(--color-brand-soft),var(--color-surface)_58%)]",
        )}
      >
        <div className="w-fit rounded-full bg-accent-soft px-2 py-1 text-xs font-bold uppercase tracking-wider text-accent">
          Little Scout
        </div>
        <h1 className="max-w-[14ch] text-3xl tracking-tight">What are you looking for?</h1>
        <p className="m-0 max-w-[34rem] text-text-muted">
          Little Scout helps parents pick restaurants by starter speed, useful kid-friendly details,
          and real notes from other caregivers.
        </p>
        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-text-muted" htmlFor="home-place-search">
            Search by restaurant name or place
          </label>
          <PlaceSearchBox
            onSelectPlace={handleSelectPlace}
            onSelectRestaurant={handleSelectRestaurant}
            placeholder="Try a restaurant name, city, or neighborhood"
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3" aria-label="Ways to explore restaurants">
        {options.map((option) => (
          <Link
            key={option.title}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm transition-[border-color,transform,box-shadow] duration-fast ease-out hover:-translate-y-px hover:border-brand/40 hover:shadow-md"
            to={option.to}
          >
            <span className="grid h-11 w-11 place-items-center rounded-md bg-brand-soft text-2xl" aria-hidden>
              {option.icon}
            </span>
            <span className="grid gap-1">
              <span className="font-extrabold tracking-tight">{option.title}</span>
              <span className="text-sm text-text-muted">{option.description}</span>
            </span>
            <span className="min-w-[4.5rem] justify-self-end text-right text-xs font-extrabold whitespace-nowrap text-brand">
              {loading ? <Skeleton className="block h-3 w-16" /> : option.metric}
            </span>
          </Link>
        ))}
      </section>

      {error && (
        <p className="m-0 text-sm font-semibold text-error">
          Could not load live restaurant counts. You can still search or browse all restaurants.
        </p>
      )}

      <Card
        title="New to Little Scout?"
        subtitle="TTF means time from ordering to a kid-friendly starter on the table."
        accent
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-1">
            <strong>Speed</strong>
            <span className="text-sm text-text-muted">Median starter timing from parent observations.</span>
          </div>
          <div className="grid gap-1">
            <strong>Signals</strong>
            <span className="text-sm text-text-muted">Notes for high chairs, noise, space, and other family details.</span>
          </div>
          <div className="grid gap-1">
            <strong>Scout</strong>
            <span className="text-sm text-text-muted">Add one quick observation after a visit to help other parents.</span>
          </div>
        </div>
        <ButtonLink to="/restaurants" variant="secondary" fullWidth>
          Browse every restaurant
        </ButtonLink>
      </Card>
    </div>
  );
}
