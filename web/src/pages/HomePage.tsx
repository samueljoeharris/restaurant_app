import { useMemo } from "react";
import { Link } from "react-router-dom";

import { PlaceSearchBox } from "../components/PlaceSearchBox";
import { ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { usePlaceSearchHandlers } from "../hooks/usePlaceSearchHandlers";
import { useFullRestaurantCatalog } from "../hooks/useRestaurantMapCatalog";
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
    <div className="home-page page-enter">
      <section className="home-hero">
        <div className="home-hero__eyebrow">Little Scout</div>
        <h1 className="home-hero__title">What are you looking for?</h1>
        <p className="home-hero__subtitle">
          Little Scout helps parents pick restaurants by starter speed, useful kid-friendly details,
          and real notes from other caregivers.
        </p>
        <div className="home-search">
          <label className="home-search__label" htmlFor="home-place-search">
            Search by restaurant name or place
          </label>
          <PlaceSearchBox
            onSelectPlace={handleSelectPlace}
            onSelectRestaurant={handleSelectRestaurant}
            placeholder="Try a restaurant name, city, or neighborhood"
          />
        </div>
      </section>

      <section className="home-options" aria-label="Ways to explore restaurants">
        {options.map((option) => (
          <Link key={option.title} className="home-option" to={option.to}>
            <span className="home-option__icon" aria-hidden>
              {option.icon}
            </span>
            <span className="home-option__body">
              <span className="home-option__title">{option.title}</span>
              <span className="home-option__desc">{option.description}</span>
            </span>
            <span className="home-option__meta">
              {loading ? <Skeleton className="home-option__skeleton" /> : option.metric}
            </span>
          </Link>
        ))}
      </section>

      {error && (
        <p className="home-error error">
          Could not load live restaurant counts. You can still search or browse all restaurants.
        </p>
      )}

      <Card
        title="New to Little Scout?"
        subtitle="TTF means time from ordering to a kid-friendly starter on the table."
        accent
      >
        <div className="home-education">
          <div>
            <strong>Speed</strong>
            <span>Median starter timing from parent observations.</span>
          </div>
          <div>
            <strong>Signals</strong>
            <span>Notes for high chairs, noise, space, and other family details.</span>
          </div>
          <div>
            <strong>Scout</strong>
            <span>Add one quick observation after a visit to help other parents.</span>
          </div>
        </div>
        <ButtonLink to="/restaurants" variant="secondary" fullWidth>
          Browse every restaurant
        </ButtonLink>
      </Card>
    </div>
  );
}
