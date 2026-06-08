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
  status: "ok" | "insufficient_data";
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
