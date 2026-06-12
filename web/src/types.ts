export interface RestaurantSummary {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  cuisine_tags: string[];
  pilot_city: string;
}

export interface RestaurantMapEntry extends RestaurantSummary {
  ttf: TtfAggregate;
  note_count: number;
  attribute_rating_count: number;
}

export interface RestaurantSeedJob {
  id: string;
  pilot_city: string;
  area_key: string;
  query: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  refresh: boolean;
  kind: "area" | "catalog";
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  requested_by: string | null;
  requested_by_display: string | null;
  error: string | null;
  inserted_count: number;
  updated_count: number;
  closed_count: number;
  outside_area_count: number;
  tombstoned_count: number;
  reactivated_count: number;
  skipped_count: number;
  out_of_area_count: number;
  unique_places_count: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  gcp_links?: GcpConsoleLinks | null;
}

export interface GcpConsoleLinks {
  run_logs_url: string;
  cloud_run_url: string;
  pubsub_subscription_url: string | null;
  pubsub_topic_url: string | null;
  scheduler_url: string | null;
}

export interface LocationRefreshConfig {
  pilot_city: string;
  enabled: boolean;
  schedule_cron: string;
  schedule_timezone: string;
  default_location: string | null;
  default_lat: number | null;
  default_lng: number | null;
  default_radius_m: number;
  last_scheduled_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface SchedulerSyncStatus {
  status: "synced" | "skipped" | "failed";
  detail: string | null;
}

export interface LocationRefreshConfigSaveResponse {
  config: LocationRefreshConfig;
  scheduler_sync: SchedulerSyncStatus;
}

export interface AdminAuditLogRow {
  id: string;
  category: "refresh_config" | "seed_location";
  action: string;
  entity_id: string | null;
  changed_by_uid: string | null;
  changed_by_email: string | null;
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface RestaurantChangelogRow {
  id: string;
  restaurant_id: string | null;
  google_place_id: string | null;
  restaurant_name: string | null;
  action: "added" | "updated" | "tombstoned" | "reactivated" | "closed" | "outside_area";
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  seed_job_id: string | null;
  changed_fields: Record<string, unknown> | null;
  created_at: string;
}

export interface RestaurantSeedJobResponse {
  job: RestaurantSeedJob;
  reused: boolean;
}

export interface AdminRefreshRunResponse {
  jobs: RestaurantSeedJob[];
}

export interface SeedLocation {
  id: string;
  pilot_city: string;
  area_key: string;
  label: string;
  query: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  enabled: boolean;
  source: "seed" | "admin" | "migration";
  created_by: string | null;
  last_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TtfAggregate {
  sample_size: number;
  median_minutes: number | null;
  avg_quality: number | null;
  last_updated: string | null;
}

export interface RestaurantDetail {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  cuisine_tags: string[];
  pilot_city: string;
  google_place_id: string | null;
  google_maps_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface RestaurantDetailResponse {
  restaurant: RestaurantDetail;
  ttf: TtfAggregate;
}

export interface UserProfile {
  firebase_uid: string;
  display_name: string | null;
  email: string | null;
  contribution_count: number;
  role?: string | null;
}

export interface AdminOverviewStats {
  pilot_city: string;
  pilot_display_name: string;
  restaurant_count: number;
  restaurants_with_ttf: number;
  restaurants_with_any_data: number;
  ttf_observation_count: number;
  attribute_rating_count: number;
  note_count: number;
  contributor_count: number;
  ttf_last_7_days: number;
  attribute_ratings_last_7_days: number;
  notes_last_7_days: number;
  median_ttf_minutes: number | null;
  avg_ttf_quality: number | null;
}

export interface AdminActivityDay {
  day: string;
  ttf_count: number;
  attribute_count: number;
  note_count: number;
}

export interface AdminContributorRow {
  firebase_uid: string;
  email: string | null;
  display_name: string | null;
  disabled: boolean | null;
  ttf_count: number;
  attribute_count: number;
  note_count: number;
  total_contributions: number;
  last_active_at: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminRestaurantRow {
  id: string;
  name: string;
  address: string;
  cuisine_tags: string[];
  status: "active" | "closed" | "outside_area" | "tombstoned";
  tombstone_reason: string | null;
  ttf_sample_size: number;
  ttf_median_minutes: number | null;
  ttf_avg_quality: number | null;
  attribute_rating_count: number;
  note_count: number;
  updated_at: string;
}

export interface AdminObservationRow {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  firebase_uid: string;
  elapsed_minutes: number;
  item_type: string;
  item_quality: number;
  daypart: string;
  created_at: string;
}

export interface TtfSubmission {
  elapsed_minutes: number;
  item_type: "fries" | "apple_slices" | "bread" | "kids_meal" | "other";
  item_quality: number;
  portion_size: "kid" | "regular" | "shareable";
  daypart: "breakfast" | "lunch" | "dinner" | "late";
  party_size_kids: number;
  wait_context?: string;
}

export interface MetricDefinition {
  key: string;
  label: string;
  metric_type: string;
  category: string;
  input_widget: string;
  min_sample_size: number;
  enum_values: string[] | null;
  min_value: number | null;
  max_value: number | null;
}

export interface AttributeEntry {
  key: string;
  label: string;
  category: string;
  metric_type: string;
  sample_size: number;
  min_sample_size: number;
  status: "ok" | "early" | "insufficient_data";
  message?: string;
  aggregate?: {
    value: boolean | number | string | null;
    confidence?: number;
    true_pct?: number;
    distribution?: Record<string, number>;
  };
}

export interface RestaurantNote {
  id: string;
  text: string;
  tags: string[];
  created_at: string;
}
