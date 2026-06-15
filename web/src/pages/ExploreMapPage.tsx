import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { MapLocateFab } from "../components/MapLocateFab";
import { MapSearchSidebar } from "../components/MapSearchSidebar";
import { PlaceSearchBox } from "../components/PlaceSearchBox";
import { RestaurantListCard } from "../components/RestaurantListCard";
import { RestaurantMap } from "../components/RestaurantMap";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonList } from "../components/ui/Skeleton";
import { useAreaCoverage } from "../hooks/useAreaCoverage";
import { useRefreshOnNavigate } from "../hooks/useRefreshOnNavigate";
import { runBackgroundCoverage } from "../lib/backgroundCoverage";
import { geolocationErrorMessage, getCurrentPosition } from "../lib/geolocation";
import {
  buildPendingPlaceParams,
  DEFAULT_SEARCH_RADIUS_M,
  RESTAURANT_SEED_RADIUS_M,
  type MapFocusState,
  type PlaceSearchPending,
  type RestaurantSearchSelection,
} from "../lib/searchNavigation";
import {
  buildExploreFacets,
  groupRestaurantsByCity,
  matchesBrowseFilters,
  matchesExploreSearch,
  matchesScoutFilter,
  type ScoutFilter,
} from "../lib/exploreFacets";
import type { RestaurantMapEntry } from "../types";

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
    <Link className={`explore-filter${active ? " explore-filter--active" : ""}`} to={to}>
      {label} ({count})
    </Link>
  );
}

export function ExploreMapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { idToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Keep filter links on whichever route mounted this page (/map or /restaurants).
  const basePath = location.pathname;

  const exploreUrl = useCallback(
    (params: {
      filter: ScoutFilter;
      q: string;
      city: string | null;
      zip: string | null;
      tag: string | null;
    }) => {
      const search = new URLSearchParams();
      if (params.filter !== "all") search.set("filter", params.filter);
      if (params.q.trim()) search.set("q", params.q.trim());
      if (params.city) search.set("city", params.city);
      if (params.zip) search.set("zip", params.zip);
      if (params.tag) search.set("tag", params.tag);
      const qs = search.toString();
      return qs ? `${basePath}?${qs}` : basePath;
    },
    [basePath],
  );

  // Radius-search params
  const paramLat = searchParams.get("lat");
  const paramLng = searchParams.get("lng");
  const paramRadius = searchParams.get("radius");
  const paramPlace = searchParams.get("place");
  const paramPlaceId = searchParams.get("place_id");
  const focusParam = searchParams.get("focus");

  const radiusLat = paramLat ? parseFloat(paramLat) : null;
  const radiusLng = paramLng ? parseFloat(paramLng) : null;
  const radiusM = paramRadius ? parseInt(paramRadius, 10) : DEFAULT_SEARCH_RADIUS_M;
  const isRadiusMode =
    radiusLat !== null && radiusLng !== null && !isNaN(radiusLat) && !isNaN(radiusLng);
  const isPendingPlaceMode = Boolean(paramPlaceId && !isRadiusMode);

  // Explore browse / filter params
  const activeFilter = getScoutFilter(searchParams.get("filter"));
  const query = searchParams.get("q") ?? "";
  const browseCity = searchParams.get("city");
  const browseZip = searchParams.get("zip");
  const browseTag = searchParams.get("tag");

  const focusState = location.state as MapFocusState | null;
  const focusLocation = focusState?.focusLocation ?? null;

  const [restaurants, setRestaurants] = useState<RestaurantMapEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Map selection (sheet + highlight) and focus (pan/zoom trigger).
  const [selectedId, setSelectedId] = useState<string | null>(focusParam);
  const [focusId, setFocusId] = useState<string | null>(focusParam);
  // Sync selection when arriving with ?focus=<id> — adjust state during render
  // (React-recommended over a setState-in-effect).
  const [prevFocusParam, setPrevFocusParam] = useState(focusParam);
  if (focusParam !== prevFocusParam) {
    setPrevFocusParam(focusParam);
    if (focusParam) {
      setSelectedId(focusParam);
      setFocusId(focusParam);
    }
  }

  // Locate-me + catalog seeding (map controls).
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [catalogSeeding, setCatalogSeeding] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activeCardRef = useRef<HTMLElement>(null);

  // ——— Data loading ———
  const loadRadiusResults = useCallback(
    (lat: number, lng: number, radius: number, opts?: { silent?: boolean }) => {
      let cancelled = false;
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
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

  const loadAllRestaurants = useCallback((opts?: { silent?: boolean }) => {
    let cancelled = false;
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    api
      .listRestaurantsForMap()
      .then((data) => {
        if (!cancelled) setRestaurants(data);
      })
      .catch((err) => {
        if (!cancelled && !opts?.silent) {
          setError(err instanceof Error ? err.message : "Load failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Silent reload of whichever data source is currently active (after seeding). */
  const refreshActiveData = useCallback(() => {
    if (isRadiusMode && radiusLat !== null && radiusLng !== null) {
      loadRadiusResults(radiusLat, radiusLng, radiusM, { silent: true });
    } else {
      loadAllRestaurants({ silent: true });
    }
  }, [isRadiusMode, radiusLat, radiusLng, radiusM, loadRadiusResults, loadAllRestaurants]);

  // Area coverage seeding for radius mode (silent refetch on completion).
  const { state: coverageState, ensureArea } = useAreaCoverage(refreshActiveData);

  // Pending place: resolve coords, then switch into radius mode on the same route.
  useEffect(() => {
    if (!isPendingPlaceMode || !paramPlaceId || !idToken) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const sessionToken =
        (location.state as { placeSessionToken?: string } | null)?.placeSessionToken ??
        crypto.randomUUID();

      api
        .resolvePlace(paramPlaceId, sessionToken, idToken)
        .then((resolved) => {
          if (cancelled) return;
          const params = new URLSearchParams();
          params.set("lat", String(resolved.lat));
          params.set("lng", String(resolved.lng));
          params.set("radius", String(radiusM));
          params.set("place", resolved.label);
          navigate(`${basePath}?${params.toString()}`, { replace: true });
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not resolve place");
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isPendingPlaceMode, paramPlaceId, idToken, location.state, navigate, radiusM, basePath]);

  // Radius mode: load catalog hits immediately, seed more venues in the background.
  useEffect(() => {
    if (!(isRadiusMode && radiusLat !== null && radiusLng !== null)) return;
    let cancel: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      cancel = loadRadiusResults(radiusLat, radiusLng, radiusM);
      void ensureArea(radiusLat, radiusLng, radiusM);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      cancel?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRadiusMode, radiusLat, radiusLng, radiusM]);

  // Default mode: load the full catalog (and refresh when re-entering the route).
  useRefreshOnNavigate(
    useCallback(() => {
      if (!isRadiusMode && !isPendingPlaceMode) return loadAllRestaurants();
      return () => {};
    }, [isRadiusMode, isPendingPlaceMode, loadAllRestaurants]),
    [isRadiusMode, isPendingPlaceMode, loadAllRestaurants],
  );

  // Scroll the matching card into view when the map selection changes.
  useEffect(() => {
    if (selectedId && activeCardRef.current) {
      activeCardRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId]);

  // ——— Search box handlers (stay on the combined view) ———
  const handleSelectPlace = useCallback(
    (pending: PlaceSearchPending) => {
      const params = buildPendingPlaceParams(pending);
      navigate(`${basePath}?${params.toString()}`, {
        state: { placeSessionToken: pending.session_token },
      });
    },
    [navigate, basePath],
  );

  const handleSelectRestaurant = useCallback(
    (selection: RestaurantSearchSelection) => {
      if (idToken && selection.lat != null && selection.lng != null) {
        runBackgroundCoverage(selection.lat, selection.lng, RESTAURANT_SEED_RADIUS_M, idToken);
      }
      const params = new URLSearchParams(searchParams);
      params.set("focus", selection.restaurant_id);
      const state: MapFocusState | undefined =
        selection.lat != null && selection.lng != null
          ? { focusLocation: { lat: selection.lat, lng: selection.lng } }
          : undefined;
      navigate(`${basePath}?${params.toString()}`, { replace: true, state });
      setSelectedId(selection.restaurant_id);
      setFocusId(selection.restaurant_id);
    },
    [idToken, searchParams, navigate, basePath],
  );

  // ——— Map control handlers ———
  const handleMapSelectChange = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id && focusParam) {
        const params = new URLSearchParams(searchParams);
        params.delete("focus");
        setSearchParams(params, { replace: true });
        setFocusId(null);
      }
    },
    [focusParam, searchParams, setSearchParams],
  );

  const handleListSelect = useCallback((id: string) => {
    setSelectedId(id);
    setFocusId(id);
  }, []);

  const seedCatalogArea = useCallback(
    (lat: number, lng: number, radius: number, message: string) => {
      if (!idToken) {
        setStatusMessage("Sign in to find more restaurants in this area.");
        return;
      }
      setCatalogSeeding(true);
      setStatusMessage(message);
      runBackgroundCoverage(lat, lng, radius, idToken, () => {
        setCatalogSeeding(false);
        setStatusMessage(null);
        refreshActiveData();
      });
    },
    [idToken, refreshActiveData],
  );

  const handleLocateMe = useCallback(async () => {
    setLocating(true);
    setStatusMessage(null);
    try {
      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setUserLocation({ lat, lng });
      if (idToken) {
        seedCatalogArea(lat, lng, DEFAULT_SEARCH_RADIUS_M, "Finding restaurants near you…");
      }
    } catch (err) {
      setStatusMessage(geolocationErrorMessage(err));
    } finally {
      setLocating(false);
    }
  }, [idToken, seedCatalogArea]);

  const handleSearchArea = useCallback(
    (lat: number, lng: number, radius: number) => {
      seedCatalogArea(lat, lng, radius, "Searching this area…");
    },
    [seedCatalogArea],
  );

  function clearRadiusMode() {
    navigate(basePath);
  }

  function clearBrowseParam(key: "city" | "zip" | "tag") {
    const params = new URLSearchParams(searchParams);
    params.delete(key);
    setSearchParams(params, { replace: true });
  }

  // ——— Derived view state ———
  const urlState = useMemo(
    () => ({ filter: activeFilter, q: query, city: browseCity, zip: browseZip, tag: browseTag }),
    [activeFilter, query, browseCity, browseZip, browseTag],
  );

  const facets = useMemo(() => buildExploreFacets(restaurants), [restaurants]);

  const filtered = useMemo(() => {
    if (isRadiusMode) return restaurants;
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

  const summaryText = useMemo(() => {
    if (isPendingPlaceMode) return "Locating area…";
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
  }, [
    isPendingPlaceMode,
    isRadiusMode,
    coverageState.status,
    filtered.length,
    activeFilter,
    browseTag,
    browseCity,
    browseZip,
    query,
    withContributions,
  ]);

  const radiusSeeding = (isRadiusMode || isPendingPlaceMode) && coverageState.status === "seeding";
  const searchBusy = catalogSeeding || radiusSeeding;
  const showListLoading = loading || isPendingPlaceMode;

  const fitKey = isRadiusMode ? `r:${radiusLat},${radiusLng},${radiusM}` : "catalog";

  function renderCard(r: RestaurantMapEntry) {
    return (
      <li key={r.id}>
        <RestaurantListCard
          ref={selectedId === r.id ? activeCardRef : undefined}
          restaurant={r}
          active={selectedId === r.id}
          onSelect={() => handleListSelect(r.id)}
        />
      </li>
    );
  }

  return (
    <div className="explore-map-page">
      {statusMessage && (
        <p
          className={`map-status-toast${
            statusMessage.includes("Sign in") ||
            statusMessage.includes("denied") ||
            statusMessage.includes("unavailable")
              ? " map-status-toast--error"
              : ""
          }`}
          role="status"
        >
          {statusMessage}
        </p>
      )}

      <RestaurantMap
        restaurants={filtered}
        focusId={focusId}
        focusLocation={focusLocation}
        selectedId={selectedId}
        onSelectChange={handleMapSelectChange}
        loading={loading}
        error={error}
        searchBusy={searchBusy}
        userLocation={userLocation}
        withSidebar
        fitKey={fitKey}
        onSearchArea={handleSearchArea}
      />

      <MapLocateFab
        busy={locating}
        active={userLocation !== null}
        onClick={() => void handleLocateMe()}
      />

      <MapSearchSidebar resultCount={filtered.length}>
        <PlaceSearchBox
          onSelectPlace={handleSelectPlace}
          onSelectRestaurant={handleSelectRestaurant}
          placeholder="Search by name, place, or neighborhood…"
        />

        {(isRadiusMode || isPendingPlaceMode) && (
          <div className="radius-banner">
            <span className="radius-banner__text">
              {paramPlace
                ? isPendingPlaceMode
                  ? `Places near ${paramPlace} · locating area`
                  : `Places near ${paramPlace} · within ${Math.round(radiusM / 1000)} km`
                : isPendingPlaceMode
                  ? "Locating area…"
                  : `Within ${Math.round(radiusM / 1000)} km`}
            </span>
            {radiusSeeding && <span className="radius-banner__seeding">finding more nearby…</span>}
            <button type="button" className="radius-banner__clear" onClick={clearRadiusMode}>
              Clear
            </button>
          </div>
        )}

        {!isRadiusMode &&
          !isPendingPlaceMode &&
          !showListLoading &&
          restaurants.length > 0 && (
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
                <nav
                  className="explore-filters explore-filters--secondary"
                  aria-label="Browse by ZIP"
                >
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
                <nav
                  className="explore-filters explore-filters--secondary"
                  aria-label="Browse by type"
                >
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

        {!isRadiusMode && !isPendingPlaceMode && (
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

        {!isRadiusMode &&
          !isPendingPlaceMode &&
          (browseCity || browseZip || browseTag) && (
            <div className="explore-active-browse">
              {browseCity && (
                <button
                  type="button"
                  className="explore-active-browse__chip"
                  onClick={() => clearBrowseParam("city")}
                >
                  {browseCity} ×
                </button>
              )}
              {browseZip && (
                <button
                  type="button"
                  className="explore-active-browse__chip"
                  onClick={() => clearBrowseParam("zip")}
                >
                  ZIP {browseZip} ×
                </button>
              )}
              {browseTag && (
                <button
                  type="button"
                  className="explore-active-browse__chip"
                  onClick={() => clearBrowseParam("tag")}
                >
                  {browseTag} ×
                </button>
              )}
            </div>
          )}

        {!showListLoading && !error && (
          <div className="explore-summary">
            <Badge tone="brand">{formatPlaceCount(filtered.length)}</Badge>
            <span className="muted small">{summaryText}</span>
          </div>
        )}

        {showListLoading && <SkeletonList count={6} />}
        {error && <p className="error">{error}</p>}

        {!showListLoading && !error && filtered.length > 0 && grouped && (
          <div className="explore-groups">
            {grouped.map(({ city, items }) => (
              <section key={city} className="explore-group">
                <header className="explore-group__header">
                  <h2>{city}</h2>
                  <span className="muted small">{formatPlaceCount(items.length)}</span>
                </header>
                <ul className="list">{items.map(renderCard)}</ul>
              </section>
            ))}
          </div>
        )}

        {!showListLoading && !error && filtered.length > 0 && !grouped && (
          <ul className="list">{filtered.map(renderCard)}</ul>
        )}

        {!showListLoading && !error && filtered.length === 0 && restaurants.length > 0 && (
          <EmptyState
            emoji="🔎"
            title="No matches"
            description={
              isRadiusMode || isPendingPlaceMode
                ? "No restaurants found in this area. Try a larger radius."
                : "Try a different search term, town, ZIP, or filter."
            }
          />
        )}

        {!showListLoading && !error && restaurants.length === 0 && (
          <EmptyState
            emoji="🔎"
            title="No restaurants yet"
            description={
              isRadiusMode || isPendingPlaceMode
                ? "No restaurants found in this area yet. Check back soon — we may still be scouting it."
                : "The catalog is still filling in for this area. Check back soon."
            }
          />
        )}
      </MapSearchSidebar>
    </div>
  );
}
