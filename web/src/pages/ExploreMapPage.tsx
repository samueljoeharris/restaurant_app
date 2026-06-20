import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { ExploreFilterBar } from "../components/ExploreFilterBar";
import { MapLocateFab } from "../components/MapLocateFab";
import { MapSearchSidebar } from "../components/MapSearchSidebar";
import { PlaceSearchBox } from "../components/PlaceSearchBox";
import { RestaurantListCard } from "../components/RestaurantListCard";
import { RestaurantMap } from "../components/RestaurantMap";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonList } from "../components/ui/Skeleton";
import { cn } from "../lib/cn";
import {
  mergeRestaurantMapEntries,
  useRestaurantMapEntries,
} from "../hooks/useRestaurantMapCatalog";
import { useMapViewportRestaurants } from "../hooks/useMapViewportRestaurants";
import { geolocationErrorMessage, getCurrentPosition } from "../lib/geolocation";
import { findMapEntry, mapEntryKey } from "../lib/mapEntryKey";
import { runBackgroundCoverage } from "../lib/backgroundCoverage";
import { bboxAround } from "../lib/mapViewport";
import { schedulePopInClear } from "../lib/mapSearchPopIn";
import { searchZoomModeForEntry } from "../lib/mapSearchView";
import { ensureNearbyAt, ensureViewportRestaurants, getRestaurantMapEntries } from "../lib/restaurantMapCache";
import {
  appendRestaurantFocusToParams,
  buildResolvedPlaceParams,
  buildRestaurantRadiusParams,
  DEFAULT_SEARCH_RADIUS_M,
  readFocusLocationFromParams,
  RESTAURANT_SEED_RADIUS_M,
  selectionToMapEntryStub,
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
import type { RestaurantDetailResponse, RestaurantMapEntry } from "../types";

function detailToMapEntry(detail: RestaurantDetailResponse): RestaurantMapEntry {
  return {
    id: detail.restaurant.id,
    name: detail.restaurant.name,
    address: detail.restaurant.address,
    lat: detail.restaurant.lat,
    lng: detail.restaurant.lng,
    cuisine_tags: detail.restaurant.cuisine_tags,
    pilot_city: detail.restaurant.pilot_city,
    google_place_id: detail.restaurant.google_place_id,
    google_maps_url: detail.restaurant.google_maps_url,
    ttf: detail.ttf,
    note_count: 0,
    attribute_rating_count: 0,
  };
}

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
  const focusLocation = readFocusLocationFromParams(searchParams, focusState);

  const catalogRestaurants = useRestaurantMapEntries();
  const [radiusRestaurants, setRadiusRestaurants] = useState<RestaurantMapEntry[]>([]);
  const restaurants = isRadiusMode ? radiusRestaurants : catalogRestaurants;
  const restaurantsRef = useRef<RestaurantMapEntry[]>([]);
  useEffect(() => {
    restaurantsRef.current = restaurants;
  }, [restaurants]);

  // Merge stub pin when arriving from Home search (navigation state).
  const optimisticSel = focusState?.optimisticRestaurant;
  const optimisticRestaurantId = optimisticSel?.restaurant_id ?? null;
  const mergedOptimisticIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!optimisticSel || !optimisticRestaurantId) return;
    if (mergedOptimisticIdRef.current === optimisticRestaurantId) return;
    mergedOptimisticIdRef.current = optimisticRestaurantId;
    const stub = selectionToMapEntryStub(optimisticSel);
    if (stub) mergeRestaurantMapEntries([stub]);
  }, [optimisticRestaurantId, optimisticSel]);

  const [error, setError] = useState<string | null>(null);
  const [radiusLoading, setRadiusLoading] = useState(false);
  const [viewportFetched, setViewportFetched] = useState(false);
  const lastViewportRef = useRef<ReturnType<typeof bboxAround> | null>(null);

  const loading =
    isPendingPlaceMode ||
    (isRadiusMode
      ? radiusLoading
      : !viewportFetched && catalogRestaurants.length === 0 && error === null);

  // Map selection (sheet + highlight) and focus (pan/zoom trigger).
  // URL ?focus= wins over local selection so deep links work without render-time setState.
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const [localFocusId, setLocalFocusId] = useState<string | null>(null);
  const [focusPulse, setFocusPulse] = useState(0);
  const selectedId = focusParam ?? localSelectedId;
  const focusId = focusParam ?? localFocusId;

  // Locate-me + catalog seeding (map controls).
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [popInKeys, setPopInKeys] = useState<ReadonlySet<string>>(() => new Set());

  const activeCardRef = useRef<HTMLElement>(null);
  const searchPopInRef = useRef(false);
  const focusKeyRef = useRef<string | null>(null);
  const activatingPlaceRef = useRef<string | null>(null);

  const registerPopIn = useCallback((keys: string[]) => {
    if (keys.length === 0) return;
    setPopInKeys((prev) => new Set([...prev, ...keys]));
    schedulePopInClear(keys, (cleared) => {
      setPopInKeys((prev) => {
        const next = new Set(prev);
        for (const k of cleared) next.delete(k);
        return next;
      });
    });
  }, []);

  // ——— Data loading ———
  const loadRadiusResults = useCallback(
    (lat: number, lng: number, radius: number, opts?: { silent?: boolean }) => {
      let cancelled = false;
      if (!opts?.silent) {
        setRadiusLoading(true);
        setError(null);
      }

      const load = idToken
        ? api.placesNearby({ lat, lng, radius_m: radius }, idToken)
        : api.searchRestaurants({ lat, lng, radius_m: radius });

      load
        .then((data) => {
          if (cancelled) return;
          const excludeKey = focusKeyRef.current ?? focusParam ?? undefined;
          const newKeys = mergeRestaurantMapEntries(data, excludeKey);
          const focusEntry = excludeKey
            ? findMapEntry(getRestaurantMapEntries(), excludeKey)
            : undefined;
          let list = data;
          if (focusEntry && !data.some((r) => mapEntryKey(r) === excludeKey)) {
            list = [focusEntry, ...data];
          }
          setRadiusRestaurants(list);
          if (searchPopInRef.current && newKeys.length > 0) {
            registerPopIn(newKeys);
          }
          searchPopInRef.current = false;
        })
        .catch((err) => {
          if (!cancelled) {
            searchPopInRef.current = false;
            setError(err instanceof Error ? err.message : "Load failed");
          }
        })
        .finally(() => {
          if (!cancelled) setRadiusLoading(false);
        });
      return () => {
        cancelled = true;
      };
    },
    [idToken, focusParam, registerPopIn],
  );

  const refreshActiveData = useCallback(() => {
    if (isRadiusMode && radiusLat !== null && radiusLng !== null) {
      loadRadiusResults(radiusLat, radiusLng, radiusM, { silent: true });
      return;
    }
    if (lastViewportRef.current) {
      void ensureViewportRestaurants(lastViewportRef.current, idToken, true);
    }
  }, [isRadiusMode, radiusLat, radiusLng, radiusM, loadRadiusResults, idToken]);

  const viewportEnabled = !isRadiusMode && !isPendingPlaceMode;
  const { onViewportChange, resetViewportGate } = useMapViewportRestaurants(viewportEnabled, idToken);

  const applySearchFocus = useCallback(
    (focusKey: string) => {
      focusKeyRef.current = focusKey;
      setLocalSelectedId(focusKey);
      setLocalFocusId(focusKey);
      setFocusPulse((p) => p + 1);
      resetViewportGate();
    },
    [resetViewportGate],
  );

  const activatePlaceSelection = useCallback(
    async (placeId: string, sessionToken: string) => {
      if (!idToken) return;
      searchPopInRef.current = true;
      setError(null);
      try {
        const resolved = await api.resolvePlace(placeId, sessionToken, idToken);
        const entry = await api.getPlaceEntry(placeId, idToken);
        mergeRestaurantMapEntries([entry]);
        const focusKey = mapEntryKey(entry);
        applySearchFocus(focusKey);
        const params = buildResolvedPlaceParams(resolved, placeId);
        navigate(`${basePath}?${params.toString()}`, { replace: true });
        runBackgroundCoverage(resolved.lat, resolved.lng, RESTAURANT_SEED_RADIUS_M, idToken);
      } catch (err) {
        searchPopInRef.current = false;
        setError(err instanceof Error ? err.message : "Could not resolve place");
      }
    },
    [idToken, applySearchFocus, navigate, basePath],
  );

  const handleViewportChange = useCallback(
    (bbox: ReturnType<typeof bboxAround>) => {
      lastViewportRef.current = bbox;
      setViewportFetched(true);
      onViewportChange(bbox);
    },
    [onViewportChange],
  );

  useEffect(() => {
    if (focusParam) resetViewportGate();
  }, [focusParam, focusPulse, resetViewportGate]);

  // Pending place (from Home or in-page search): resolve, show pin + sheet, then load nearby async.
  useEffect(() => {
    if (!isPendingPlaceMode || !paramPlaceId || !idToken) {
      activatingPlaceRef.current = null;
      return;
    }
    if (activatingPlaceRef.current === paramPlaceId) return;
    activatingPlaceRef.current = paramPlaceId;
    const sessionToken =
      (location.state as { placeSessionToken?: string } | null)?.placeSessionToken ??
      crypto.randomUUID();
    void activatePlaceSelection(paramPlaceId, sessionToken);
  }, [isPendingPlaceMode, paramPlaceId, idToken, location.state, activatePlaceSelection]);

  useEffect(() => {
    if (!(isRadiusMode && radiusLat !== null && radiusLng !== null)) return;
    let cancel: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      cancel = loadRadiusResults(radiusLat, radiusLng, radiusM);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      cancel?.();
    };
  }, [isRadiusMode, radiusLat, radiusLng, radiusM, loadRadiusResults]);

  // Ensure focused restaurant is on the map even if filters exclude it.
  useEffect(() => {
    if (!focusParam) return;
    if (restaurantsRef.current.some((r) => mapEntryKey(r) === focusParam)) return;
    if (getRestaurantMapEntries().some((r) => mapEntryKey(r) === focusParam)) return;

    let cancelled = false;
    const loc = focusLocation;

    void (async () => {
      if (focusParam.startsWith("place:") && idToken) {
        const placeId = focusParam.slice("place:".length);
        try {
          const entry = await api.getPlaceEntry(placeId, idToken);
          if (cancelled) return;
          mergeRestaurantMapEntries([entry]);
        } catch {
          // Pin/sheet may stay in loading state if the id is invalid.
        }
        return;
      }

      if (loc) {
        try {
          const nearby = await api.listRestaurantsForMap(bboxAround(loc.lat, loc.lng));
          if (cancelled) return;
          if (nearby.some((r) => r.id === focusParam || mapEntryKey(r) === focusParam)) {
            mergeRestaurantMapEntries(nearby);
            return;
          }
        } catch {
          // fall through to single-restaurant fetch
        }
      }

      try {
        const detail = await api.getRestaurant(focusParam);
        if (cancelled) return;
        mergeRestaurantMapEntries([detailToMapEntry(detail)]);
      } catch {
        // Pin/sheet may stay in loading state if the id is invalid.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [focusParam, focusLocation, idToken]);

  // Scroll the matching card into view when the map selection changes.
  useEffect(() => {
    if (selectedId && activeCardRef.current) {
      activeCardRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId]);

  // ——— Search box handlers (stay on the combined view) ———
  const handleSelectPlace = useCallback(
    (pending: PlaceSearchPending) => {
      void activatePlaceSelection(pending.place_id, pending.session_token);
    },
    [activatePlaceSelection],
  );

  const handleSelectRestaurant = useCallback(
    async (selection: RestaurantSearchSelection) => {
      searchPopInRef.current = true;
      let entry: RestaurantMapEntry | null = selectionToMapEntryStub(selection);
      if (idToken && selection.restaurant_id) {
        try {
          entry = detailToMapEntry(await api.getRestaurant(selection.restaurant_id));
        } catch {
          // keep autocomplete stub when detail fetch fails
        }
      }
      if (entry) {
        mergeRestaurantMapEntries([entry]);
        applySearchFocus(mapEntryKey(entry));
      } else if (selection.lat != null && selection.lng != null) {
        applySearchFocus(selection.restaurant_id);
      } else {
        focusKeyRef.current = selection.restaurant_id;
        setLocalSelectedId(selection.restaurant_id);
        setLocalFocusId(selection.restaurant_id);
        setFocusPulse((p) => p + 1);
      }

      if (selection.lat != null && selection.lng != null && idToken) {
        runBackgroundCoverage(
          selection.lat,
          selection.lng,
          RESTAURANT_SEED_RADIUS_M,
          idToken,
        );
      }

      const radiusParams = buildRestaurantRadiusParams(selection);
      const params = radiusParams ?? new URLSearchParams(searchParams);
      if (!radiusParams) {
        appendRestaurantFocusToParams(params, selection);
        if (selection.name) params.set("q", selection.name);
      }

      const state: MapFocusState | undefined =
        selection.lat != null && selection.lng != null
          ? {
              focusLocation: { lat: selection.lat, lng: selection.lng },
              optimisticRestaurant: selection,
            }
          : undefined;

      setSearchParams(params, { replace: true, state });
    },
    [idToken, searchParams, setSearchParams, applySearchFocus],
  );

  // ——— Map control handlers ———
  const ensureMapEntryLoaded = useCallback(
    async (key: string) => {
      if (!key.startsWith("place:") || !idToken) return;
      if (findMapEntry(getRestaurantMapEntries(), key)) return;
      const placeId = key.slice("place:".length);
      try {
        const entry = await api.getPlaceEntry(placeId, idToken);
        mergeRestaurantMapEntries([entry]);
        if (isRadiusMode) {
          setRadiusRestaurants((prev) =>
            prev.some((r) => mapEntryKey(r) === key) ? prev : [entry, ...prev],
          );
        }
      } catch {
        // Sheet stays in loading state if fetch fails.
      }
    },
    [idToken, isRadiusMode],
  );

  const handleMapSelectChange = useCallback(
    (id: string | null) => {
      setLocalSelectedId(id);
      if (id) {
        void ensureMapEntryLoaded(id);
      }
      if (!id && focusParam) {
        const params = new URLSearchParams(searchParams);
        params.delete("focus");
        params.delete("flat");
        params.delete("flng");
        setSearchParams(params, { replace: true });
        setLocalFocusId(null);
      }
    },
    [focusParam, searchParams, setSearchParams, ensureMapEntryLoaded],
  );

  const handleListSelect = useCallback(
    (id: string) => {
      setLocalSelectedId(id);
      setLocalFocusId(id);
      setFocusPulse((p) => p + 1);
      void ensureMapEntryLoaded(id);
    },
    [ensureMapEntryLoaded],
  );

  const fetchNearbyArea = useCallback(
    (lat: number, lng: number, radius: number, message: string) => {
      if (!idToken) {
        setStatusMessage("Sign in to explore nearby restaurants from Google.");
        return;
      }
      setNearbyLoading(true);
      setStatusMessage(message);
      void ensureNearbyAt(lat, lng, radius, idToken, true)
        .then(() => refreshActiveData())
        .catch(() => setStatusMessage("Could not load nearby restaurants."))
        .finally(() => {
          setNearbyLoading(false);
          setStatusMessage(null);
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
        fetchNearbyArea(lat, lng, DEFAULT_SEARCH_RADIUS_M, "Loading restaurants near you…");
      }
    } catch (err) {
      setStatusMessage(geolocationErrorMessage(err));
    } finally {
      setLocating(false);
    }
  }, [idToken, fetchNearbyArea]);

  const handleSearchArea = useCallback(
    (lat: number, lng: number, radius: number) => {
      fetchNearbyArea(lat, lng, radius, "Loading restaurants in this area…");
    },
    [fetchNearbyArea],
  );

  function clearRadiusMode() {
    navigate(basePath);
  }

  function clearBrowseParam(key: "city" | "zip" | "tag") {
    const params = new URLSearchParams(searchParams);
    params.delete(key);
    setSearchParams(params, { replace: true });
  }

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

  /** Pins + sheet: always include focused/selected venues even when browse filters hide them. */
  const mapRestaurants = useMemo(() => {
    const keys = new Set(filtered.map((r) => mapEntryKey(r)));
    const extras: RestaurantMapEntry[] = [];
    for (const key of [focusParam, selectedId]) {
      if (!key || keys.has(key)) continue;
      const entry =
        findMapEntry(restaurants, key) ?? findMapEntry(catalogRestaurants, key);
      if (entry) {
        extras.push(entry);
        keys.add(mapEntryKey(entry));
      }
    }
    return extras.length > 0 ? [...filtered, ...extras] : filtered;
  }, [filtered, restaurants, catalogRestaurants, focusParam, selectedId]);

  const searchFocusEntry = useMemo(() => {
    if (!focusParam) return undefined;
    return (
      findMapEntry(mapRestaurants, focusParam) ??
      findMapEntry(getRestaurantMapEntries(), focusParam)
    );
  }, [focusParam, mapRestaurants]);

  const focusZoomMode = useMemo(
    () =>
      searchZoomModeForEntry(
        searchFocusEntry,
        Boolean(focusParam),
        isRadiusMode,
      ),
    [searchFocusEntry, focusParam, isRadiusMode],
  );

  const areaCenter =
    isRadiusMode && !focusParam && radiusLat != null && radiusLng != null
      ? { lat: radiusLat, lng: radiusLng }
      : null;

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
    if (nearbyLoading) return "Loading nearby restaurants…";
    if (isPendingPlaceMode) return "Locating area…";
    if (isRadiusMode) {
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
    nearbyLoading,
    isPendingPlaceMode,
    isRadiusMode,
    filtered.length,
    activeFilter,
    browseTag,
    browseCity,
    browseZip,
    query,
    withContributions,
  ]);

  const searchBusy = nearbyLoading || radiusLoading;
  const showListLoading = (loading && restaurants.length === 0) || isPendingPlaceMode;

  const fitKey = isRadiusMode ? `r:${radiusLat},${radiusLng},${radiusM}` : "catalog";

  function renderCard(r: RestaurantMapEntry) {
    const key = mapEntryKey(r);
    return (
      <li key={key}>
        <RestaurantListCard
          ref={selectedId === key ? activeCardRef : undefined}
          restaurant={r}
          active={selectedId === key}
          onSelect={() => handleListSelect(key)}
          density="compact"
          showWatch
        />
      </li>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      {statusMessage && (
        <p
          className={cn(
            "pointer-events-none absolute bottom-5 left-1/2 z-[6] m-0 max-w-[min(20rem,calc(100%-2rem))] -translate-x-1/2 rounded-full border border-border bg-surface/95 px-3 py-2 text-center text-xs leading-snug text-text shadow-md",
            (statusMessage.includes("Sign in") ||
              statusMessage.includes("denied") ||
              statusMessage.includes("unavailable")) &&
              "border-error/25 text-error",
          )}
          role="status"
        >
          {statusMessage}
        </p>
      )}

      <div className="relative h-full min-h-0">
        <RestaurantMap
          restaurants={mapRestaurants}
          focusId={focusId}
          focusLocation={focusLocation}
          focusPulse={focusPulse}
          selectedId={selectedId}
          onSelectChange={handleMapSelectChange}
          loading={loading}
          error={error}
          searchBusy={searchBusy}
          userLocation={userLocation}
          withSidebar
          fitKey={fitKey}
          onSearchArea={handleSearchArea}
          onViewportChange={viewportEnabled ? handleViewportChange : undefined}
          popInKeys={popInKeys}
          searchFocusId={focusParam}
          focusZoomMode={focusZoomMode}
          areaCenter={areaCenter}
          areaRadiusM={radiusM}
        />

        <MapLocateFab
          busy={locating}
          active={userLocation !== null}
          onClick={() => void handleLocateMe()}
        />
      </div>

      <MapSearchSidebar
        resultCount={filtered.length}
        search={
          <PlaceSearchBox
            onSelectPlace={handleSelectPlace}
            onSelectRestaurant={handleSelectRestaurant}
            placeholder="Search by name, place, or neighborhood…"
          />
        }
      >
        {(isRadiusMode || isPendingPlaceMode) && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand/25 bg-brand-soft px-4 py-3 text-sm">
            <span className="flex-1 font-semibold text-brand">
              {paramPlace
                ? isPendingPlaceMode
                  ? `Places near ${paramPlace} · locating area`
                  : `Places near ${paramPlace} · within ${Math.round(radiusM / 1000)} km`
                : isPendingPlaceMode
                  ? "Locating area…"
                  : `Within ${Math.round(radiusM / 1000)} km`}
            </span>
            {radiusLoading && (
              <span className="text-xs text-text-muted italic">loading nearby…</span>
            )}
            <button
              type="button"
              className="cursor-pointer rounded-full border border-brand px-[0.6rem] py-[0.2rem] font-[inherit] text-xs font-bold text-brand transition-[background,color] duration-fast hover:bg-brand hover:text-text-inverse"
              onClick={clearRadiusMode}
            >
              Clear
            </button>
          </div>
        )}

        {!isRadiusMode &&
          !isPendingPlaceMode &&
          !showListLoading &&
          restaurants.length > 0 && (
            <ExploreFilterBar
              activeFilter={activeFilter}
              browseCity={browseCity}
              browseZip={browseZip}
              browseTag={browseTag}
              cities={facets.cities}
              zips={facets.zips}
              tags={facets.tags}
              resultCount={filtered.length}
              exploreUrl={exploreUrl}
              query={query}
              filtersOpen={filtersOpen}
              onToggleFilters={() => setFiltersOpen((v) => !v)}
            />
          )}

        {!isRadiusMode &&
          !isPendingPlaceMode &&
          (browseCity || browseZip || browseTag) && (
            <div className="mb-3 flex flex-wrap gap-2">
              {browseCity && (
                <button
                  type="button"
                  className="cursor-pointer rounded-full border border-border-strong bg-surface px-[0.65rem] py-[0.35rem] font-[inherit] text-sm text-text"
                  onClick={() => clearBrowseParam("city")}
                >
                  {browseCity} ×
                </button>
              )}
              {browseZip && (
                <button
                  type="button"
                  className="cursor-pointer rounded-full border border-border-strong bg-surface px-[0.65rem] py-[0.35rem] font-[inherit] text-sm text-text"
                  onClick={() => clearBrowseParam("zip")}
                >
                  ZIP {browseZip} ×
                </button>
              )}
              {browseTag && (
                <button
                  type="button"
                  className="cursor-pointer rounded-full border border-border-strong bg-surface px-[0.65rem] py-[0.35rem] font-[inherit] text-sm text-text"
                  onClick={() => clearBrowseParam("tag")}
                >
                  {browseTag} ×
                </button>
              )}
            </div>
          )}

        {!showListLoading && !error && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge variant="brand">{formatPlaceCount(filtered.length)}</Badge>
            <span className="text-sm text-text-muted">{summaryText}</span>
          </div>
        )}

        {showListLoading && <SkeletonList count={6} />}
        {error && <p className="text-sm font-semibold text-error">{error}</p>}

        {!showListLoading && !error && filtered.length > 0 && grouped && (
          <div className="grid gap-6">
            {grouped.map(({ city, items }) => (
              <section key={city}>
                <header className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="m-0 text-lg">{city}</h2>
                  <span className="text-sm text-text-muted">{formatPlaceCount(items.length)}</span>
                </header>
                <ul className="m-0 grid list-none gap-3 p-0">{items.map(renderCard)}</ul>
              </section>
            ))}
          </div>
        )}

        {!showListLoading && !error && filtered.length > 0 && !grouped && (
          <ul className="m-0 grid list-none gap-3 p-0">{filtered.map(renderCard)}</ul>
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
