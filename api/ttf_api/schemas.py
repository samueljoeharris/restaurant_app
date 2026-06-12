from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class HealthResponse(BaseModel):
    status: str = "ok"
    pilot_city: str
    pilot_display_name: str


class RestaurantSummary(BaseModel):
    id: UUID
    name: str
    address: str
    lat: float
    lng: float
    cuisine_tags: list[str]
    pilot_city: str


class RestaurantDetail(RestaurantSummary):
    google_place_id: str | None = None
    google_maps_url: str | None = None
    created_at: datetime
    updated_at: datetime


class MetricDefinition(BaseModel):
    key: str
    label: str
    metric_type: str
    category: str
    input_widget: str
    min_sample_size: int
    enum_values: list[str] | None = None
    min_value: int | None = None
    max_value: int | None = None


class TtfAggregate(BaseModel):
    sample_size: int = 0
    median_minutes: float | None = None
    avg_quality: float | None = None
    last_updated: datetime | None = None


class RestaurantMapEntry(RestaurantSummary):
    ttf: TtfAggregate
    note_count: int = 0
    attribute_rating_count: int = 0


class RestaurantDetailResponse(BaseModel):
    restaurant: RestaurantDetail
    ttf: TtfAggregate = Field(default_factory=TtfAggregate)


class RestaurantSeedJobRequest(BaseModel):
    location: str | None = Field(None, min_length=2, max_length=200)
    lat: float | None = None
    lng: float | None = None
    radius_m: int = Field(default=8000, ge=1000, le=25000)
    force: bool = False

    @model_validator(mode="after")
    def require_location_or_coordinates(self) -> "RestaurantSeedJobRequest":
        has_location = bool(self.location and self.location.strip())
        has_lat_lng = self.lat is not None and self.lng is not None
        if has_location == has_lat_lng:
            raise ValueError("Provide either location or both lat and lng")
        return self


class GcpConsoleLinks(BaseModel):
    run_logs_url: str
    cloud_run_url: str
    pubsub_subscription_url: str | None = None
    pubsub_topic_url: str | None = None
    scheduler_url: str | None = None


class RestaurantSeedJob(BaseModel):
    id: UUID
    pilot_city: str
    area_key: str
    query: str | None = None
    lat: float
    lng: float
    radius_m: int
    refresh: bool = False
    kind: Literal["area", "catalog"] = "area"
    status: Literal["pending", "running", "succeeded", "failed", "skipped"]
    requested_by: str | None = None
    requested_by_display: str | None = None
    error: str | None = None
    inserted_count: int = 0
    updated_count: int = 0
    closed_count: int = 0
    outside_area_count: int = 0
    tombstoned_count: int = 0
    reactivated_count: int = 0
    skipped_count: int = 0
    out_of_area_count: int = 0
    unique_places_count: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    gcp_links: GcpConsoleLinks | None = None


class RestaurantSeedJobResponse(BaseModel):
    job: RestaurantSeedJob
    reused: bool = False


class RestaurantSeedJobsListResponse(BaseModel):
    items: list[RestaurantSeedJob]
    total: int
    limit: int
    offset: int


class AdminSeedJobRequest(BaseModel):
    location: str | None = Field(None, min_length=2, max_length=200)
    lat: float | None = None
    lng: float | None = None
    radius_m: int = Field(default=8000, ge=1000, le=25000)
    force: bool = False

    @model_validator(mode="after")
    def require_location_or_coordinates(self) -> "AdminSeedJobRequest":
        has_location = bool(self.location and self.location.strip())
        has_lat_lng = self.lat is not None and self.lng is not None
        if has_location == has_lat_lng:
            raise ValueError("Provide either location or both lat and lng")
        return self


class AdminRefreshRunResponse(BaseModel):
    jobs: list[RestaurantSeedJob]


class SeedLocation(BaseModel):
    id: UUID
    pilot_city: str
    area_key: str
    label: str
    query: str | None = None
    lat: float
    lng: float
    radius_m: int
    enabled: bool
    source: Literal["seed", "admin", "migration"]
    created_by: str | None = None
    last_refreshed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class SeedLocationsResponse(BaseModel):
    items: list[SeedLocation]


class SeedLocationCreate(BaseModel):
    location: str = Field(min_length=2, max_length=200)
    radius_m: int = Field(default=8000, ge=1000, le=25000)


class SeedLocationUpdate(BaseModel):
    enabled: bool | None = None
    radius_m: int | None = Field(None, ge=1000, le=25000)
    label: str | None = Field(None, min_length=2, max_length=200)


class LocationRefreshConfig(BaseModel):
    pilot_city: str
    enabled: bool
    schedule_cron: str
    schedule_timezone: str
    default_location: str | None = None
    default_lat: float | None = None
    default_lng: float | None = None
    default_radius_m: int
    last_scheduled_at: datetime | None = None
    updated_at: datetime | None = None
    updated_by: str | None = None


class LocationRefreshConfigUpdate(BaseModel):
    enabled: bool | None = None
    schedule_cron: str | None = Field(None, min_length=5, max_length=100)
    schedule_timezone: str | None = Field(None, min_length=3, max_length=64)
    default_location: str | None = Field(None, min_length=2, max_length=200)
    default_lat: float | None = None
    default_lng: float | None = None
    default_radius_m: int | None = Field(None, ge=1000, le=25000)


class SchedulerSyncStatus(BaseModel):
    status: Literal["synced", "skipped", "failed"]
    detail: str | None = None


class LocationRefreshConfigSaveResponse(BaseModel):
    config: LocationRefreshConfig
    scheduler_sync: SchedulerSyncStatus


class AdminAuditLogRow(BaseModel):
    id: UUID
    category: Literal["refresh_config", "seed_location"]
    action: str
    entity_id: str | None = None
    changed_by_uid: str | None = None
    changed_by_email: str | None = None
    previous_values: dict | None = None
    new_values: dict | None = None
    metadata: dict | None = None
    created_at: datetime


class AdminAuditLogResponse(BaseModel):
    items: list[AdminAuditLogRow]
    total: int
    limit: int
    offset: int


class RestaurantChangelogRow(BaseModel):
    id: UUID
    restaurant_id: UUID | None = None
    google_place_id: str | None = None
    restaurant_name: str | None = None
    action: Literal["added", "updated", "tombstoned", "reactivated", "closed", "outside_area"]
    previous_status: str | None = None
    new_status: str | None = None
    reason: str | None = None
    seed_job_id: UUID | None = None
    changed_fields: dict | None = None
    created_at: datetime


class RestaurantChangelogResponse(BaseModel):
    items: list[RestaurantChangelogRow]
    total: int
    limit: int
    offset: int


class UserProfile(BaseModel):
    firebase_uid: str
    display_name: str | None = None
    email: str | None = None
    contribution_count: int
    role: str | None = None


class CreateRestaurantRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1, max_length=500)
    lat: float
    lng: float
    google_place_id: str | None = None
    google_maps_url: str | None = None
    cuisine_tags: list[str] = Field(default_factory=list)


class TtfSubmissionRequest(BaseModel):
    ordered_at: datetime | None = None
    served_at: datetime | None = None
    elapsed_minutes: int | None = Field(None, ge=1, le=180)
    item_type: Literal["fries", "apple_slices", "bread", "kids_meal", "other"]
    item_quality: int = Field(ge=1, le=5)
    portion_size: Literal["kid", "regular", "shareable"]
    daypart: Literal["breakfast", "lunch", "dinner", "late"]
    party_size_kids: int = Field(default=1, ge=1, le=12)
    wait_context: str | None = Field(None, max_length=500)
    photo_url: str | None = None

    @model_validator(mode="after")
    def resolve_elapsed_minutes(self) -> "TtfSubmissionRequest":
        if self.elapsed_minutes is not None:
            return self
        if self.ordered_at and self.served_at:
            minutes = int((self.served_at - self.ordered_at).total_seconds() / 60)
            if minutes < 1:
                raise ValueError("served_at must be after ordered_at")
            object.__setattr__(self, "elapsed_minutes", minutes)
            return self
        raise ValueError("Provide elapsed_minutes or both ordered_at and served_at")


class TtfSubmissionResponse(BaseModel):
    id: UUID
    elapsed_minutes: int
    item_type: str
    item_quality: int


class AttributeSubmissionRequest(BaseModel):
    metric_key: str
    value: Any
    visit_context: str | None = Field(None, max_length=500)


class AttributeSubmissionResponse(BaseModel):
    id: UUID
    metric_key: str


class NoteSubmissionRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    tags: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def limit_tags(self) -> "NoteSubmissionRequest":
        if len(self.tags) > 10:
            raise ValueError("At most 10 tags allowed")
        return self


class NoteSubmissionResponse(BaseModel):
    id: UUID
    text: str
    tags: list[str]
    created_at: datetime


# --- Admin ---


class AdminFirebaseSessionResponse(BaseModel):
    custom_token: str


class AdminOverviewStats(BaseModel):
    pilot_city: str
    pilot_display_name: str
    restaurant_count: int
    restaurants_with_ttf: int
    restaurants_with_any_data: int
    ttf_observation_count: int
    attribute_rating_count: int
    note_count: int
    contributor_count: int
    ttf_last_7_days: int
    attribute_ratings_last_7_days: int
    notes_last_7_days: int
    median_ttf_minutes: float | None = None
    avg_ttf_quality: float | None = None


class AdminContributorRow(BaseModel):
    firebase_uid: str
    email: str | None = None
    display_name: str | None = None
    disabled: bool | None = None
    ttf_count: int
    attribute_count: int
    note_count: int
    total_contributions: int
    last_active_at: datetime | None = None


class AdminContributorsResponse(BaseModel):
    items: list[AdminContributorRow]
    total: int
    limit: int
    offset: int


class AdminRestaurantRow(BaseModel):
    id: UUID
    name: str
    address: str
    cuisine_tags: list[str]
    status: Literal["active", "closed", "outside_area", "tombstoned"]
    tombstone_reason: str | None = None
    ttf_sample_size: int
    ttf_median_minutes: float | None = None
    ttf_avg_quality: float | None = None
    attribute_rating_count: int
    note_count: int
    updated_at: datetime


class AdminRestaurantsResponse(BaseModel):
    items: list[AdminRestaurantRow]
    total: int
    limit: int
    offset: int


class AdminObservationRow(BaseModel):
    id: UUID
    restaurant_id: UUID
    restaurant_name: str
    firebase_uid: str
    elapsed_minutes: int
    item_type: str
    item_quality: int
    daypart: str
    created_at: datetime


class AdminObservationsResponse(BaseModel):
    items: list[AdminObservationRow]
    total: int
    limit: int
    offset: int


class AdminActivityDay(BaseModel):
    day: str
    ttf_count: int
    attribute_count: int
    note_count: int


class AdminActivityResponse(BaseModel):
    days: list[AdminActivityDay]
