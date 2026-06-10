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
