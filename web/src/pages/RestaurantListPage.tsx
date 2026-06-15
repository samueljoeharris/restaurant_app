import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import { PlaceSearchBox } from "../components/PlaceSearchBox";
import { RestaurantListCard } from "../components/RestaurantListCard";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Page } from "../components/ui/Page";
import { SkeletonList } from "../components/ui/Skeleton";
import { useAreaCoverage } from "../hooks/useAreaCoverage";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import {
  buildExploreFacets,
  groupRestaurantsByCity,
  matchesBrowseFilters,
  matchesExploreSearch,
  matchesScoutFilter,
  type ScoutFilter,
} from "../lib/exploreFacets";
import type { PlaceResolveResponse, RestaurantMapEntry } from "../types";

const scoutFilterLabels: Record<ScoutFilter, string> = {
  all: "All",
  "fast-starters": "Quick starters",
  "parent-data": "Parent-rated",
  "needs-data": "Needs scouting",
};

const scoutFilterSummaries: Record<Exclude<ScoutFilter, "all">, string> = {
  "fast-starters": "Places with starter-speed observations of 10 minutes or less.",
  "parent-data": "Restaurants with at least one parent observation, rating, or note.",
  "needs-data": "Restaurants still waiting for a first parent contribution.",
};

function getScoutFilter(value: string | null): ScoutFilter {
  if (value === "fast-starters" || value === "parent-data" || value === "needs-data") {
    return value;
  }
  return "all";
}

function formatPlaceCount(count: number) {
  return `${count} ${count === 1 ? "place" : "places"}`;
}

function exploreUrl(params: {
  filter: ScoutFilter;
  q: string;
  city: string | null;
  zip: string | null;
  tag: string | null;
}) {
  const search = new URLSearchParams();
  if (params.filter !== "all") search.set("filter", params.filter);
  if (params.q.trim()) search.set("q", params.q.trim());
  if (params.city) search.set("city", params.city);
  if (params.zip) search.set("zip", params.zip);
  if (params.tag) search.set("tag", params.tag);
  const qs = search.toString();
  return qs ? `/restaurants?${qs}` : "/restaurants";
}

function BrowseChip({
  label,
  count,
  active,
  to,
}: {
  label: string;
  count: number;
  active: boolean;
  to: string;
}) {
  return (
    <Link
      className={`explore-filter${active ? " explore-filter--active" : ""}`}
      to={to}
    >
      {label} ({count})
    </Link>
  );
}

export function RestaurantListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Radius-search params (new)
  const paramLat = searchParams.get("lat");
  const paramLng = searchParams.get("lng");
  const paramRadius = searchParams.get("radius");
  const paramPlace = searchParams.get("place");

  const radiusLat = paramLat ? parseFloat(paramLat) : null;
  const radiusLng = paramLng ? parseFloat(paramLng) : null;
  const radiusM = paramRadius ? parseInt(paramRadius, 10) : 8000;
  const isRadiusMode = radiusLat !== null && radiusLng !== null && !isNaN(radiusLat) && !isNaN(radiusLng);

  // Existing explore params
  const activeFilter = getScoutFilter(searchParams.get("filter"));
  const query = searchParams.get("q") ?? "";
  const browseCity = searchParams.get("city");
  const browseZip = searchParams.get("zip");
  const browseTag = searchParams.get("tag");

  const [restaurants, setRestaurants] = useState<RestaurantMapEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ——— Load: radius mode vs default mode ———
  const loadRadiusResults = useCallback(
    (lat: number, lng: number, radius: number) => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      api
        .searchRestaurants({ lat, lng, radius_m: radius })
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
    },
    [],
  );

  const loadAllRestaurants = useCallback(() => {
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

  // Area coverage seeding (radius mode only)
  const { state: coverageState, ensureArea } = useAreaCoverage(
    useCallback(() => {
      if (isRadiusMode && radiusLat !== null && radiusLng !== null) {
        loadRadiusResults(radiusLat, radiusLng, radiusM);
      }
    }, [isRadiusMode, radiusLat, radiusLng, radiusM, loadRadiusResults]),
  );

  // Initial load & reload on param change
  useEffect(() => {
    if (isRadiusMode && radiusLat !== null && radiusLng !== null) {
      const cancel = loadRadiusResults(radiusLat, radiusLng, radiusM);
      void ensureArea(radiusLat, radiusLng, radiusM);
      return cancel;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRadiusMode, radiusLat, radiusLng, radiusM]);

  // Default mode: refresh on navigate
  useRefreshOnNavigate(
    useCallback(() => {
      if (!isRadiusMode) return loadAllRestaurants();
      return () => {};
    }, [isRadiusMode, loadAllRestaurants]),
    [isRadiusMode, loadAllRestaurants],
  );

  // ——— PlaceSearchBox callbacks ———
  function handleSelectPlace(resolved: PlaceResolveResponse) {
    const params = new URLSearchParams();
    params.set("lat", String(resolved.lat));
    params.set("lng", String(resolved.lng));
    params.set("radius", "8000");
    params.set("place", resolved.label);
    navigate(`/restaurants?${params.toString()}`);
  }

  function handleSelectRestaurant(id: string) {
    navigate(`/restaurants/${id}`);
  }

  function clearRadiusMode() {
    navigate("/restaurants");
  }

  const urlState = useMemo(
    () => ({ filter: activeFilter, q: query, city: browseCity, zip: browseZip, tag: browseTag }),
    [activeFilter, query, browseCity, browseZip, browseTag],
  );

  const facets = useMemo(() => buildExploreFacets(restaurants), [restaurants]);

  const filtered = useMemo(() => {
    if (isRadiusMode) return restaurants; // radius results come pre-sorted
    return restaurants.filter(
      (r) =>
        matchesExploreSearch(r, query) &&
        matchesBrowseFilters(r, browseCity, browseZip, browseTag) &&
        matchesScoutFilter(r, activeFilter),
    );
  }, [restaurants, isRadiusMode, query, browseCity, browseZip, browseTag, activeFilter]);

  const grouped = useMemo(() => {
    if (isRadiusMode) return null;
    const browsing = browseCity || browseZip || browseTag || query.trim();
    if (browsing) return null;
    return groupRestaurantsByCity(filtered);
  }, [filtered, isRadiusMode, browseCity, browseZip, browseTag, query]);

  const withContributions = useMemo(
    () => restaurants.filter((r) => matchesScoutFilter(r, "parent-data")).length,
    [restaurants],
  );

  const subtitle = useMemo(() => {
    if (isRadiusMode) {
      const km = Math.round(radiusM / 1000);
      return paramPlace ? `Near ${paramPlace} · ${km} km` : `${km} km radius`;
    }
    const parts: string[] = [];
    if (browseCity) parts.push(browseCity);
    else if (browseZip) parts.push(`ZIP ${browseZip}`);
    else if (facets.cities.length > 0) {
      parts.push(`${facets.cities.length} towns`);
    }
    parts.push(`${restaurants.length} places`);
    return parts.join(" · ");
  }, [isRadiusMode, radiusM, paramPlace, browseCity, browseZip, facets.cities.length, restaurants.length]);

  const summaryText = useMemo(() => {
    if (isRadiusMode) {
      if (coverageState.status === "seeding") return "finding more nearby…";
      return `${formatPlaceCount(filtered.length)} sorted by distance`;
    }
    if (activeFilter !== "all") return scoutFilterSummaries[activeFilter];
    const bits: string[] = [];
    if (browseTag) bits.push(browseTag);
    if (browseCity) bits.push(browseCity);
    if (browseZip) bits.push(`ZIP ${browseZip}`);
    if (query.trim()) bits.push(`"${query.trim()}"`);
    if (bits.length > 0) return `Matching ${bits.join(" · ")}`;
    return `${formatPlaceCount(withContributions)} with parent data`;
  }, [isRadiusMode, coverageState.status, filtered.length, activeFilter, browseTag, browseCity, browseZip, query, withContributions]);

  function clearBrowseParam(key: "city" | "zip" | "tag") {
    const params = new URLSearchParams(searchParams);
    params.delete(key);
    setSearchParams(params, { replace: true });
  }

  const seeding = isRadiusMode && coverageState.status === "seeding";

  return (
    <Page
      title={activeFilter === "all" ? "Explore" : scoutFilterLabels[activeFilter]}
      subtitle={subtitle}
    >
      {/* PlaceSearchBox replaces the plain search input */}
      <PlaceSearchBox
        onSelectPlace={handleSelectPlace}
        onSelectRestaurant={handleSelectRestaurant}
        placeholder="Search by name, place, or neighborhood…"
      />

      {/* Radius mode: banner + optional seeding indicator */}
      {isRadiusMode && (
        <div className="radius-banner">
          <span className="radius-banner__text">
            {paramPlace
              ? `Places near ${paramPlace} · within ${Math.round(radiusM / 1000)} km`
              : `Within ${Math.round(radiusM / 1000)} km`}
          </span>
          {seeding && (
            <span className="radius-banner__seeding">finding more nearby…</span>
          )}
          <button
            type="button"
            className="radius-banner__clear"
            onClick={clearRadiusMode}
          >
            Clear
          </button>
        </div>
      )}

      {/* Default mode: facet chips */}
      {!isRadiusMode && !loading && restaurants.length > 0 && (
        <>
          {facets.cities.length > 0 && (
            <nav className="explore-filters" aria-label="Browse by town">
              {facets.cities.slice(0, 8).map((facet) => (
                <BrowseChip
                  key={facet.key}
                  label={facet.label}
                  count={facet.count}
                  active={browseCity === facet.key}
                  to={
                    browseCity === facet.key
                      ? exploreUrl({ ...urlState, city: null })
                      : exploreUrl({ ...urlState, city: facet.key, zip: null })
                  }
                />
              ))}
            </nav>
          )}

          {facets.zips.length > 1 && (
            <nav className="explore-filters explore-filters--secondary" aria-label="Browse by ZIP">
              {facets.zips.slice(0, 8).map((facet) => (
                <BrowseChip
                  key={facet.key}
                  label={facet.label}
                  count={facet.count}
                  active={browseZip === facet.key}
                  to={
                    browseZip === facet.key
                      ? exploreUrl({ ...urlState, zip: null })
                      : exploreUrl({ ...urlState, zip: facet.key, city: null })
                  }
                />
              ))}
            </nav>
          )}

          {facets.tags.length > 0 && (
            <nav className="explore-filters explore-filters--secondary" aria-label="Browse by type">
              {facets.tags.slice(0, 10).map((facet) => (
                <BrowseChip
                  key={facet.key}
                  label={facet.label}
                  count={facet.count}
                  active={browseTag === facet.key}
                  to={
                    browseTag === facet.key
                      ? exploreUrl({ ...urlState, tag: null })
                      : exploreUrl({ ...urlState, tag: facet.key })
                  }
                />
              ))}
            </nav>
          )}
        </>
      )}

      {/* Scout quality filters — only in default mode */}
      {!isRadiusMode && (
        <nav className="explore-filters explore-filters--scout" aria-label="Scout quality filters">
          {(Object.keys(scoutFilterLabels) as ScoutFilter[]).map((filter) => (
            <Link
              key={filter}
              className={`explore-filter${filter === activeFilter ? " explore-filter--active" : ""}`}
              to={exploreUrl({ ...urlState, filter })}
            >
              {scoutFilterLabels[filter]}
            </Link>
          ))}
        </nav>
      )}

      {!isRadiusMode && (browseCity || browseZip || browseTag) && (
        <div className="explore-active-browse">
          {browseCity && (
            <button type="button" className="explore-active-browse__chip" onClick={() => clearBrowseParam("city")}>
              {browseCity} ×
            </button>
          )}
          {browseZip && (
            <button type="button" className="explore-active-browse__chip" onClick={() => clearBrowseParam("zip")}>
              ZIP {browseZip} ×
            </button>
          )}
          {browseTag && (
            <button type="button" className="explore-active-browse__chip" onClick={() => clearBrowseParam("tag")}>
              {browseTag} ×
            </button>
          )}
        </div>
      )}

      {!loading && !error && (
        <div className="explore-summary">
          <Badge tone="brand">{formatPlaceCount(filtered.length)}</Badge>
          <span className="muted small">{summaryText}</span>
        </div>
      )}

      {loading && <SkeletonList count={6} />}
      {error && <p className="error">{error}</p>}

      {!loading && !error && filtered.length > 0 && grouped && (
        <div className="explore-groups">
          {grouped.map(({ city, items }) => (
            <section key={city} className="explore-group">
              <header className="explore-group__header">
                <h2>{city}</h2>
                <span className="muted small">{formatPlaceCount(items.length)}</span>
              </header>
              <ul className="list">
                {items.map((r) => (
                  <li key={r.id}>
                    <RestaurantListCard restaurant={r} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && !grouped && (
        <ul className="list">
          {filtered.map((r) => (
            <li key={r.id}>
              <RestaurantListCard restaurant={r} />
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && filtered.length === 0 && restaurants.length > 0 && (
        <EmptyState
          emoji="🔎"
          title="No matches"
          description={
            isRadiusMode
              ? "No restaurants found in this area. Try a larger radius."
              : "Try a different search term, town, ZIP, or filter."
          }
        />
      )}

      {!loading && !error && restaurants.length === 0 && (
        <EmptyState
          emoji="🔎"
          title="No restaurants yet"
          description={
            isRadiusMode
              ? "No restaurants found in this area yet. Check back soon — we may still be scouting it."
              : "The catalog is still filling in for this area. Check back soon."
          }
        />
      )}
    </Page>
  );
}
