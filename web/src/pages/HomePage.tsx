import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
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

export function HomePage() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<RestaurantMapEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useRefreshOnNavigate(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listRestaurantsForMap()
      .then((data) => {
        if (!cancelled) setRestaurants(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      metric: loading ? undefined : `${counts.fastStarter} places`,
    },
    {
      title: "Browse parent-rated spots",
      description: "See restaurants with TTF observations, notes, or family-friendly attribute ratings.",
      icon: "⭐",
      to: "/restaurants?filter=parent-data",
      metric: loading ? undefined : `${counts.withParentData} places`,
    },
    {
      title: "Open the Dedham map",
      description: "Scan the pilot area visually and tap into restaurants near your route.",
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

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/restaurants?q=${encodeURIComponent(trimmed)}` : "/restaurants");
  }

  return (
    <div className="home-page page-enter">
      <section className="home-hero">
        <div className="home-hero__eyebrow">Dedham pilot</div>
        <h1 className="home-hero__title">What are you looking for?</h1>
        <p className="home-hero__subtitle">
          Little Scout helps parents pick restaurants by starter speed, useful kid-friendly details,
          and real notes from other caregivers.
        </p>
        <form className="home-search" onSubmit={handleSearch}>
          <label className="home-search__label" htmlFor="home-search">
            Search by restaurant name
          </label>
          <div className="home-search__row">
            <input
              id="home-search"
              className="search"
              placeholder="Try pizza, cafe, or a place name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="home-search__button" type="submit">
              Search
            </button>
          </div>
        </form>
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
            <span>Add one quick observation after a visit to improve the pilot.</span>
          </div>
        </div>
        <ButtonLink to="/restaurants" variant="secondary" fullWidth>
          Browse every restaurant
        </ButtonLink>
      </Card>
    </div>
  );
}
