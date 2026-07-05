import { getAppCheckToken } from "../appCheck";
import type {
  AdminActivityDay,
  AdminAttentionStats,
  AdminAuditLogRow,
  AdminContributorDetail,
  AdminContributorRow,
  AdminObservationRow,
  AdminOverviewStats,
  AdminRefreshRunResponse,
  AdminRestaurantDetail,
  AdminRestaurantRow,
  ModerationItemRow,
  AttributeEntry,
  ContributionDraft,
  ContributionPreviewResponse,
  ContributionSubmitResponse,
  ContributionSchema,
  CoverageEnsureResponse,
  CoverageJobStatus,
  LocationRefreshConfig,
  LocationRefreshConfigSaveResponse,
  MetricDefinition,
  Paginated,
  PlacePracticalResponse,
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
  UserContribution,
  UserTtfContribution,
  ExtendedUserProfile,
  FamilyMatchResponse,
  NotificationPreferences,
  ActivityInboxResponse,
  WatchedRestaurantsResponse,
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

function normalizeMapEntries(rows: RestaurantMapEntry[]): RestaurantMapEntry[] {
  return rows.map((r) => ({
    ...r,
    note_count: r.note_count ?? 0,
    attribute_rating_count: r.attribute_rating_count ?? 0,
  }));
}

type RestaurantMapBbox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

function restaurantMapPath(bbox?: RestaurantMapBbox): string {
  if (!bbox) return "/v1/restaurants/map";
  const params = new URLSearchParams({
    min_lat: String(bbox.minLat),
    max_lat: String(bbox.maxLat),
    min_lng: String(bbox.minLng),
    max_lng: String(bbox.maxLng),
  });
  return `/v1/restaurants/map?${params}`;
}

export const api = {
  listRestaurants: (q?: string) => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    return request<RestaurantSummary[]>(`/v1/restaurants${params}`);
  },

  listRestaurantsForMap: (bbox?: RestaurantMapBbox) => {
    return request<RestaurantMapEntry[]>(restaurantMapPath(bbox)).then(normalizeMapEntries);
  },

  /** Map fetch with optional ETag revalidation (304 → notModified). */
  listRestaurantsForMapCached: async (opts?: {
    bbox?: RestaurantMapBbox;
    etag?: string | null;
  }): Promise<{
    rows: RestaurantMapEntry[] | null;
    etag: string | null;
    notModified: boolean;
  }> => {
    const path = restaurantMapPath(opts?.bbox);
    const headers = new Headers();
    if (opts?.etag) headers.set("If-None-Match", opts.etag);
    const response = await fetch(`${API_URL}${path}`, { headers });
    if (response.status === 304) {
      return {
        rows: null,
        etag: opts?.etag ?? response.headers.get("ETag"),
        notModified: true,
      };
    }
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
    const rows = normalizeMapEntries((await response.json()) as RestaurantMapEntry[]);
    return {
      rows,
      etag: response.headers.get("ETag"),
      notModified: false,
    };
  },

  getRestaurant: (id: string, token?: string | null) =>
    request<RestaurantDetailResponse>(`/v1/restaurants/${id}`, {}, token ?? undefined),

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

  getProfile: (token: string) =>
    request<ExtendedUserProfile>("/v1/me/profile", {}, token),

  patchProfile: (
    token: string,
    body: {
      kids_ages?: number[];
      home_lat?: number | null;
      home_lng?: number | null;
      home_label?: string | null;
      timezone?: string;
      allergies?: string[];
      allergy_notes?: string | null;
      dietary_restrictions?: string[];
      cuisine_likes?: string[];
      cuisine_dislikes?: string[];
      atmosphere_preferences?: string[];
      preference_notes?: string | null;
      complete_onboarding?: boolean;
    },
  ) =>
    request<ExtendedUserProfile>("/v1/me/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token),

  getFamilyMatches: (restaurantIds: string[], token: string) =>
    request<FamilyMatchResponse>("/v1/me/family-matches", {
      method: "POST",
      body: JSON.stringify({ restaurant_ids: restaurantIds }),
    }, token),

  listWatches: (token: string, opts: { limit?: number; offset?: number } = {}) => {
    const params = new URLSearchParams();
    params.set("limit", String(opts.limit ?? 50));
    params.set("offset", String(opts.offset ?? 0));
    return request<WatchedRestaurantsResponse>(`/v1/me/watches?${params}`, {}, token);
  },

  watchRestaurant: (restaurantId: string, token: string) =>
    request<{ watched: boolean }>(`/v1/me/watches/${restaurantId}`, { method: "POST" }, token),

  unwatchRestaurant: (restaurantId: string, token: string) =>
    request<void>(`/v1/me/watches/${restaurantId}`, { method: "DELETE" }, token),

  getActivityInbox: (
    token: string,
    opts: { limit?: number; offset?: number; unread_only?: boolean; restaurant_id?: string } = {},
  ) => {
    const params = new URLSearchParams();
    params.set("limit", String(opts.limit ?? 50));
    params.set("offset", String(opts.offset ?? 0));
    if (opts.unread_only) params.set("unread_only", "true");
    if (opts.restaurant_id) params.set("restaurant_id", opts.restaurant_id);
    return request<ActivityInboxResponse>(`/v1/me/activity?${params}`, {}, token);
  },

  getUnreadActivityCount: (token: string) =>
    request<{ unread_count: number }>("/v1/me/activity/unread-count", {}, token),

  markActivityRead: (token: string, through: string) =>
    request<{ unread_count: number }>("/v1/me/activity/mark-read", {
      method: "POST",
      body: JSON.stringify({ through }),
    }, token),

  getNotificationPreferences: (token: string) =>
    request<NotificationPreferences>("/v1/me/notification-preferences", {}, token),

  patchNotificationPreferences: (token: string, body: Partial<NotificationPreferences>) =>
    request<NotificationPreferences>("/v1/me/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token),

  registerPushToken: (token: string, platform: "web" | "ios", pushToken: string) =>
    request<{ id: string }>("/v1/me/push-tokens", {
      method: "POST",
      body: JSON.stringify({ platform, token: pushToken }),
    }, token),

  listMyContributions: (
    token: string,
    opts: {
      limit?: number;
      offset?: number;
      kind?: "ttf" | "attribute" | "note";
      restaurant_id?: string;
    } = {},
  ) => {
    const params = new URLSearchParams();
    params.set("limit", String(opts.limit ?? 50));
    params.set("offset", String(opts.offset ?? 0));
    if (opts.kind) params.set("kind", opts.kind);
    if (opts.restaurant_id) params.set("restaurant_id", opts.restaurant_id);
    return request<Paginated<UserContribution>>(`/v1/me/contributions?${params}`, {}, token);
  },

  getMyTtf: (observationId: string, token: string) =>
    request<UserTtfContribution>(`/v1/me/ttf/${observationId}`, {}, token),

  updateMyTtf: (observationId: string, body: TtfSubmission, token: string) =>
    request(`/v1/me/ttf/${observationId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token),

  deleteMyTtf: (observationId: string, token: string) =>
    request<void>(`/v1/me/ttf/${observationId}`, { method: "DELETE" }, token),

  updateMyAttribute: (
    ratingId: string,
    value: boolean | number | string,
    token: string,
  ) =>
    request(`/v1/me/attributes/${ratingId}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }, token),

  deleteMyAttribute: (ratingId: string, token: string) =>
    request<void>(`/v1/me/attributes/${ratingId}`, { method: "DELETE" }, token),

  updateMyNote: (noteId: string, text: string, token: string, tags: string[] = []) =>
    request<RestaurantNote>(`/v1/me/notes/${noteId}`, {
      method: "PATCH",
      body: JSON.stringify({ text, tags }),
    }, token),

  deleteMyNote: (noteId: string, token: string) =>
    request<void>(`/v1/me/notes/${noteId}`, { method: "DELETE" }, token),

  deleteAccount: (token: string) =>
    request<void>(
      "/v1/me/delete-account",
      {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      },
      token,
    ),

  authHandoff: (token: string) =>
    request<{ custom_token: string }>("/v1/auth/handoff", { method: "POST" }, token),

  submitTtf: (id: string, body: TtfSubmission, token: string) =>
    request(`/v1/restaurants/${id}/ttf`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  listMetrics: () => request<MetricDefinition[]>("/v1/metrics"),

  getContributionSchema: () =>
    request<ContributionSchema>("/v1/contribution-schema"),

  reviewChatReply: (
    restaurantName: string,
    messages: { role: "user" | "assistant"; text: string }[],
    token: string,
  ) =>
    request<{ reply: string }>(
      "/v1/review-chat/reply",
      {
        method: "POST",
        body: JSON.stringify({ restaurant_name: restaurantName, messages }),
      },
      token,
    ),

  reviewChatExtract: (
    messages: { role: "user" | "assistant"; text: string }[],
    token: string,
  ) =>
    request<{ draft: ContributionDraft; missing_required: string[]; summary: string }>(
      "/v1/review-chat/extract",
      { method: "POST", body: JSON.stringify({ messages }) },
      token,
    ),

  previewContributions: (id: string, body: ContributionDraft, token: string) =>
    request<ContributionPreviewResponse>(
      `/v1/restaurants/${id}/contributions/preview`,
      { method: "POST", body: JSON.stringify(body) },
      token,
    ),

  submitContributions: (id: string, body: ContributionDraft, token: string) =>
    request<ContributionSubmitResponse>(`/v1/restaurants/${id}/contributions`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  previewPlaceContributions: (placeId: string, body: ContributionDraft, token: string) =>
    request<ContributionPreviewResponse>(
      `/v1/places/${encodeURIComponent(placeId)}/contributions/preview`,
      { method: "POST", body: JSON.stringify(body) },
      token,
    ),

  submitPlaceContributions: (placeId: string, body: ContributionDraft, token: string) =>
    request<ContributionSubmitResponse>(`/v1/places/${encodeURIComponent(placeId)}/contributions`, {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

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

  adminAttention: (token: string) =>
    request<AdminAttentionStats>("/v1/admin/attention", {}, token),

  adminActivity: (token: string, days = 14) =>
    request<{ days: AdminActivityDay[] }>(
      `/v1/admin/activity?days=${days}`,
      {},
      token,
    ),

  adminUsers: (
    token: string,
    opts: { limit?: number; offset?: number; trust_level?: string; disabled?: boolean } = {},
  ) => {
    const params = new URLSearchParams();
    params.set("limit", String(opts.limit ?? 50));
    params.set("offset", String(opts.offset ?? 0));
    if (opts.trust_level) params.set("trust_level", opts.trust_level);
    if (opts.disabled != null) params.set("disabled", String(opts.disabled));
    return request<Paginated<AdminContributorRow>>(`/v1/admin/users?${params}`, {}, token);
  },

  adminUserDetail: (token: string, uid: string) =>
    request<AdminContributorDetail>(`/v1/admin/users/${encodeURIComponent(uid)}`, {}, token),

  adminUpdateUserTrust: (
    token: string,
    uid: string,
    body: { trust_level?: string; trust_notes?: string },
  ) =>
    request<AdminContributorDetail>(`/v1/admin/users/${encodeURIComponent(uid)}/trust`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token),

  adminDisableUser: (token: string, uid: string) =>
    request<AdminContributorDetail>(`/v1/admin/users/${encodeURIComponent(uid)}/disable`, { method: "POST" }, token),

  adminEnableUser: (token: string, uid: string) =>
    request<AdminContributorDetail>(`/v1/admin/users/${encodeURIComponent(uid)}/enable`, { method: "POST" }, token),

  adminDeleteUserAccount: (token: string, uid: string) =>
    request<void>(
      `/v1/admin/users/${encodeURIComponent(uid)}/delete-account`,
      { method: "POST" },
      token,
    ),

  adminRestaurants: (
    token: string,
    opts: {
      q?: string;
      status?: string;
      cuisine_tag?: string;
      has_pending_moderation?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.q) params.set("q", opts.q);
    if (opts.status) params.set("status", opts.status);
    if (opts.cuisine_tag) params.set("cuisine_tag", opts.cuisine_tag);
    if (opts.has_pending_moderation != null) {
      params.set("has_pending_moderation", String(opts.has_pending_moderation));
    }
    params.set("limit", String(opts.limit ?? 50));
    params.set("offset", String(opts.offset ?? 0));
    return request<Paginated<AdminRestaurantRow>>(
      `/v1/admin/restaurants?${params}`,
      {},
      token,
    );
  },

  adminRestaurantDetail: (token: string, id: string) =>
    request<AdminRestaurantDetail>(`/v1/admin/restaurants/${id}`, {}, token),

  adminUpdateRestaurant: (
    token: string,
    id: string,
    body: Partial<{
      name: string;
      address: string;
      lat: number;
      lng: number;
      cuisine_tags: string[];
      status: AdminRestaurantRow["status"];
    }>,
  ) =>
    request<AdminRestaurantDetail>(`/v1/admin/restaurants/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, token),

  adminMergeRestaurants: (
    token: string,
    body: { source_id: string; target_id: string; reason: string },
  ) =>
    request<{ status: string }>("/v1/admin/restaurants/merge", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

  adminModeration: (
    token: string,
    opts: {
      status?: string;
      content_type?: string;
      source?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) => {
    const params = new URLSearchParams();
    params.set("status", opts.status ?? "pending");
    if (opts.content_type) params.set("content_type", opts.content_type);
    if (opts.source) params.set("source", opts.source);
    params.set("limit", String(opts.limit ?? 50));
    params.set("offset", String(opts.offset ?? 0));
    return request<Paginated<ModerationItemRow>>(`/v1/admin/moderation?${params}`, {}, token);
  },

  adminModerationApprove: (token: string, id: string, review_notes?: string) =>
    request<{ status: string }>(`/v1/admin/moderation/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ review_notes: review_notes ?? null }),
    }, token),

  adminModerationReject: (token: string, id: string, review_notes?: string) =>
    request<{ status: string }>(`/v1/admin/moderation/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ review_notes: review_notes ?? null }),
    }, token),

  adminModerationEscalate: (token: string, id: string, review_notes?: string) =>
    request<{ status: string }>(`/v1/admin/moderation/${id}/escalate`, {
      method: "POST",
      body: JSON.stringify({ review_notes: review_notes ?? null }),
    }, token),

  adminObservations: (
    token: string,
    opts: {
      limit?: number;
      offset?: number;
      restaurant_id?: string;
      firebase_uid?: string;
      daypart?: string;
      excluded?: boolean;
      min_minutes?: number;
      max_minutes?: number;
    } = {},
  ) => {
    const params = new URLSearchParams();
    params.set("limit", String(opts.limit ?? 50));
    params.set("offset", String(opts.offset ?? 0));
    if (opts.restaurant_id) params.set("restaurant_id", opts.restaurant_id);
    if (opts.firebase_uid) params.set("firebase_uid", opts.firebase_uid);
    if (opts.daypart) params.set("daypart", opts.daypart);
    if (opts.excluded != null) params.set("excluded", String(opts.excluded));
    if (opts.min_minutes != null) params.set("min_minutes", String(opts.min_minutes));
    if (opts.max_minutes != null) params.set("max_minutes", String(opts.max_minutes));
    return request<Paginated<AdminObservationRow>>(
      `/v1/admin/observations?${params}`,
      {},
      token,
    );
  },

  adminExcludeObservation: (token: string, id: string, reason: string) =>
    request<{ status: string }>(`/v1/admin/observations/${id}/exclude`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }, token),

  adminRestoreObservation: (token: string, id: string) =>
    request<{ status: string }>(`/v1/admin/observations/${id}/restore`, {
      method: "POST",
    }, token),

  submitContentReport: (
    token: string,
    body: {
      content_type: "note" | "ttf_observation" | "attribute_rating";
      content_id: string;
      reason: string;
      details?: string;
    },
  ) =>
    request<{ id: string; queued: boolean }>("/v1/reports", {
      method: "POST",
      body: JSON.stringify(body),
    }, token),

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

  placesNearby: (
    opts: { lat: number; lng: number; radius_m?: number; limit?: number },
    token: string,
  ) => {
    const params = new URLSearchParams({
      lat: String(opts.lat),
      lng: String(opts.lng),
    });
    if (opts.radius_m != null) params.set("radius_m", String(opts.radius_m));
    if (opts.limit != null) params.set("limit", String(opts.limit));
    return request<RestaurantMapEntry[]>(`/v1/places/nearby?${params}`, {}, token).then(
      normalizeMapEntries,
    );
  },

  getPlaceEntry: (placeId: string, token: string) =>
    request<RestaurantMapEntry>(
      `/v1/places/${encodeURIComponent(placeId)}/entry`,
      {},
      token,
    ).then((row) => normalizeMapEntries([row])[0]),

  materializePlace: (placeId: string, token: string) =>
    request<RestaurantDetailResponse>(
      `/v1/places/${encodeURIComponent(placeId)}/materialize`,
      { method: "POST" },
      token,
    ),

  getPlacePractical: (placeId: string, token: string) =>
    request<PlacePracticalResponse>(
      `/v1/places/${encodeURIComponent(placeId)}/practical`,
      {},
      token,
    ),

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
