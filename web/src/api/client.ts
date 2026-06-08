import { getAppCheckToken } from "../appCheck";
import type {
  AttributeEntry,
  MetricDefinition,
  RestaurantDetailResponse,
  RestaurantMapEntry,
  RestaurantNote,
  RestaurantSummary,
  TtfSubmission,
  UserProfile,
} from "../types";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

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

  listRestaurantsForMap: () =>
    request<RestaurantMapEntry[]>("/v1/restaurants/map").then((rows) =>
      rows.map((r) => ({
        ...r,
        note_count: r.note_count ?? 0,
        attribute_rating_count: r.attribute_rating_count ?? 0,
      })),
    ),

  getRestaurant: (id: string) =>
    request<RestaurantDetailResponse>(`/v1/restaurants/${id}`),

  getMe: (token: string) =>
    request<UserProfile>("/v1/me", {}, token),

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
};
