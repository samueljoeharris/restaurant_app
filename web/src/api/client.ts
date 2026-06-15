import { getAppCheckToken } from "../appCheck";
import type {
  AdminActivityDay,
  AdminAuditLogRow,
  AdminContributorRow,
  AdminObservationRow,
  AdminOverviewStats,
  AdminRefreshRunResponse,
  AdminRestaurantRow,
  AttributeEntry,
  CoverageEnsureResponse,
  CoverageJobStatus,
  LocationRefreshConfig,
  LocationRefreshConfigSaveResponse,
  MetricDefinition,
  Paginated,
  PlaceResolveResponse,
  PlaceSuggestion,
  RestaurantChangelogRow,
  RestaurantDetailResponse,
  RestaurantMapEntry,
  RestaurantSeedJob,
  RestaurantSeedJobResponse,
  RestaurantNote,
  RestaurantSummary,
  SeedLocation,
  TtfSubmission,
  UserProfile,
} from "../types";

// In dev, Vite proxies /v1 → VITE_API_URL so any localhost port avoids CORS.
const API_URL = import.meta.env.DEV
  ? ""
  : (import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "");

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    const appCheckToken = await getAppCheckToken();
    if (appCheckToken) {
      headers.set("X-Firebase-AppCheck", appCheckToken);
    }
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const data = (await response.json()) as { detail?: string };
      if (data.detail) detail = data.detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const api = {
  listRestaurants: (q?: string) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    return request<RestaurantSummary[]>(`/v1/restaurants${params}`);
  },

  listRestaurantsForMap: (bbox?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }) => {
    let path = "/v1/restaurants/map";
    if (bbox) {
      const params = new URLSearchParams({
        min_lat: String(bbox.minLat),
        max_lat: String(bbox.maxLat),
        min_lng: String(bbox.minLng),
        max_lng: String(bbox.maxLng),
      });
      path += `?${params}`;
    }
    return request<RestaurantMapEntry[]>(path).then((rows) =>
      rows.map((r) => ({
        ...r,
        note_count: r.note_count ?? 0,
        attribute_rating_count: r.attribute_rating_count ?? 0,
      })),
    );
  },

  triggerRestaurantSeed: (
    body: { location: string; radius_m?: number; force?: boolean },
    token: string,
  ) =>
    request<RestaurantSeedJobResponse>("/v1/restaurants/seed-jobs", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  getRestaurantSeedJob: (id: string, token: string) =>
    request<RestaurantSeedJobResponse>(`/v1/restaurants/seed-jobs/${id}`, {}, token),

  getRestaurant: (id: string) =>
    request<RestaurantDetailResponse>(`/v1/restaurants/${id}`),

  ensureCoverage: (
    body: { lat: number; lng: number; radius_m?: number },
    token: string,
  ) =>
    request<CoverageEnsureResponse>("/v1/coverage/ensure", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  getCoverageJob: (jobId: string, token: string) =>
    request<CoverageJobStatus>(`/v1/coverage/jobs/${jobId}`, {}, token),

  getMe: (token: string) =>
    request<UserProfile>("/v1/me", {}, token),

  authHandoff: (token: string) =>
    request<{ custom_token: string }>("/v1/auth/handoff", { method: "POST" }, token),

  submitTtf: (id: string, body: TtfSubmission, token: string) =>
    request(`/v1/restaurants/${id}/ttf`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  listMetrics: () => request<MetricDefinition[]>("/v1/metrics"),

  getAttributes: (id: string) =>
    request<{ attributes: Record<string, AttributeEntry> }>(
      `/v1/restaurants/${id}/attributes`,
    ),

  submitAttribute: (
    id: string,
    metricKey: string,
    value: boolean | number | string,
    token: string,
  ) =>
    request(`/v1/restaurants/${id}/attributes`, {
      method: "POST",
      body: JSON.stringify({ metric_key: metricKey, value }),
    }, token),

  listNotes: (id: string) =>
    request<{ notes: RestaurantNote[] }>(`/v1/restaurants/${id}/notes`),

  submitNote: (id: string, text: string, token: string, tags: string[] = []) =>
    request<RestaurantNote>(`/v1/restaurants/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ text, tags }),
    }, token),

  adminStats: (token: string) =>
    request<AdminOverviewStats>("/v1/admin/stats", {}, token),

  adminActivity: (token: string, days = 14) =>
    request<{ days: AdminActivityDay[] }>(
      `/v1/admin/activity?days=${days}`,
      {},
      token,
    ),

  adminUsers: (token: string, limit = 50, offset = 0) =>
    request<Paginated<AdminContributorRow>>(
      `/v1/admin/users?limit=${limit}&offset=${offset}`,
      {},
      token,
    ),

  adminRestaurants: (token: string, opts: { q?: string; limit?: number; offset?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.q) params.set("q", opts.q);
    params.set("limit", String(opts.limit ?? 50));
    params.set("offset", String(opts.offset ?? 0));
    return request<Paginated<AdminRestaurantRow>>(
      `/v1/admin/restaurants?${params}`,
      {},
      token,
    );
  },

  adminObservations: (token: string, limit = 50, offset = 0) =>
    request<Paginated<AdminObservationRow>>(
      `/v1/admin/observations?limit=${limit}&offset=${offset}`,
      {},
      token,
    ),

  adminSeedJobs: (token: string, limit = 50, offset = 0) =>
    request<Paginated<RestaurantSeedJob>>(
      `/v1/admin/seed-jobs?limit=${limit}&offset=${offset}`,
      {},
      token,
    ),

  adminGetSeedJob: (token: string, jobId: string) =>
    request<RestaurantSeedJobResponse>(`/v1/admin/seed-jobs/${jobId}`, {}, token),

  adminTriggerSeedJob: (
    token: string,
    body: {
      location?: string;
      lat?: number;
      lng?: number;
      radius_m?: number;
      force?: boolean;
    },
  ) =>
    request<RestaurantSeedJobResponse>("/v1/admin/seed-jobs", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  adminTriggerRefreshRuns: (token: string) =>
    request<AdminRefreshRunResponse>("/v1/admin/refresh-runs", {
      method: "POST",
    }, token),

  adminSeedLocations: (token: string) =>
    request<{ items: SeedLocation[] }>("/v1/admin/seed-locations", {}, token),

  adminAddSeedLocation: (
    token: string,
    body: { location: string; radius_m?: number },
  ) =>
    request<SeedLocation>("/v1/admin/seed-locations", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  adminUpdateSeedLocation: (
    token: string,
    locationId: string,
    body: Partial<{ enabled: boolean; radius_m: number; label: string }>,
  ) =>
    request<SeedLocation>(`/v1/admin/seed-locations/${locationId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token),

  adminDeleteSeedLocation: (token: string, locationId: string) =>
    request<void>(`/v1/admin/seed-locations/${locationId}`, {
      method: "DELETE",
    }, token),

  adminRefreshConfig: (token: string) =>
    request<LocationRefreshConfig>("/v1/admin/refresh-config", {}, token),

  adminUpdateRefreshConfig: (
    token: string,
    body: Partial<{
      enabled: boolean;
      schedule_cron: string;
      schedule_timezone: string;
      default_location: string;
      default_lat: number;
      default_lng: number;
      default_radius_m: number;
    }>,
  ) =>
    request<LocationRefreshConfigSaveResponse>("/v1/admin/refresh-config", {
      method: "PUT",
      body: JSON.stringify(body),
    }, token),

  adminAuditLog: (
    token: string,
    opts: { limit?: number; offset?: number; category?: "refresh_config" | "seed_location" } = {},
  ) => {
    const params = new URLSearchParams();
    params.set("limit", String(opts.limit ?? 20));
    params.set("offset", String(opts.offset ?? 0));
    if (opts.category) params.set("category", opts.category);
    return request<Paginated<AdminAuditLogRow>>(
      `/v1/admin/audit-log?${params}`,
      {},
      token,
    );
  },

  adminRestaurantChangelog: (
    token: string,
    opts: { limit?: number; offset?: number; action?: string } = {},
  ) => {
    const params = new URLSearchParams();
    params.set("limit", String(opts.limit ?? 50));
    params.set("offset", String(opts.offset ?? 0));
    if (opts.action) params.set("action", opts.action);
    return request<Paginated<RestaurantChangelogRow>>(
      `/v1/admin/restaurant-changelog?${params}`,
      {},
      token,
    );
  },

  placesAutocomplete: (
    q: string,
    opts: { sessionToken: string; lat?: number; lng?: number },
    token: string,
  ) => {
    const params = new URLSearchParams({ q, session_token: opts.sessionToken });
    if (opts.lat != null) params.set("lat", String(opts.lat));
    if (opts.lng != null) params.set("lng", String(opts.lng));
    return request<{ suggestions: PlaceSuggestion[] }>(
      `/v1/places/autocomplete?${params}`,
      {},
      token,
    );
  },

  resolvePlace: (placeId: string, sessionToken: string, token: string) => {
    const params = new URLSearchParams({ place_id: placeId, session_token: sessionToken });
    return request<PlaceResolveResponse>(`/v1/places/resolve?${params}`, {}, token);
  },

  searchRestaurants: (opts: {
    lat: number;
    lng: number;
    radius_m?: number;
    q?: string;
    limit?: number;
  }) => {
    const params = new URLSearchParams({
      lat: String(opts.lat),
      lng: String(opts.lng),
    });
    if (opts.radius_m != null) params.set("radius_m", String(opts.radius_m));
    if (opts.q) params.set("q", opts.q);
    if (opts.limit != null) params.set("limit", String(opts.limit));
    return request<RestaurantMapEntry[]>(`/v1/restaurants/search?${params}`);
  },
};
