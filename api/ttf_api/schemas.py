import re
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

from ttf_api.place_id import validate_and_quote_place_id


class HealthResponse(BaseModel):
    status: str = "ok"
    pilot_city: str
    pilot_display_name: str


class RestaurantSummary(BaseModel):
    id: UUID | None = None
    google_place_id: str | None = None
    name: str
    address: str
    lat: float
    lng: float
    cuisine_tags: list[str]
    pilot_city: str
    google_maps_url: str | None = None

    @model_validator(mode="after")
    def require_identity(self) -> "RestaurantSummary":
        if self.id is None and not self.google_place_id:
            raise ValueError("RestaurantSummary requires id or google_place_id")
        return self


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


class ContributionRecency(BaseModel):
    """Combined TTF + attribute rating counts by age bucket (exclusive)."""

    last_7_days: int = 0
    days_8_to_30: int = 0
    days_31_to_180: int = 0
    over_365_days: int = 0
    total: int = 0


class RestaurantMapEntry(RestaurantSummary):
    ttf: TtfAggregate
    note_count: int = 0
    attribute_rating_count: int = 0
    watched: bool = False
    scouting_requested: bool = False


class RestaurantDetailResponse(BaseModel):
    restaurant: RestaurantDetail
    ttf: TtfAggregate = Field(default_factory=TtfAggregate)
    contribution_recency: ContributionRecency = Field(default_factory=ContributionRecency)
    watched: bool = False


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


class CoverageEnsureRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    radius_m: int = Field(default=8000, ge=1000, le=25000)


class CoverageEnsureResponse(BaseModel):
    status: Literal["queued", "covered"]
    restaurant_count: int = 0
    radius_m: int
    job_id: UUID | None = None
    reused: bool = False


class CoverageJobStatus(BaseModel):
    job_id: UUID
    status: Literal["pending", "running", "succeeded", "failed", "skipped"]
    inserted_count: int = 0
    updated_count: int = 0


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
    category: Literal[
        "refresh_config",
        "seed_location",
        "moderation",
        "observation",
        "user_trust",
        "restaurant",
    ]
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
    watch_count: int = 0
    unread_activity_count: int = 0


class NotificationPreferences(BaseModel):
    cadence: Literal["weekly", "daily", "realtime_bundle"] = "realtime_bundle"
    quiet_hours_start: str = "20:00"
    quiet_hours_end: str = "08:00"
    alert_new_ttf: bool = False
    alert_new_rating: bool = False
    alert_new_note: bool = False
    alert_every_review: bool = False
    push_enabled: bool = False


class ExtendedUserProfile(UserProfile):
    kids_ages: list[int] = Field(default_factory=list)
    home_lat: float | None = None
    home_lng: float | None = None
    home_label: str | None = None
    onboarding_completed: bool = False
    inbox_read_through: datetime
    timezone: str = "America/New_York"
    # Family profile v2 (#85) — private to the account; never expose in
    # public aggregates, activity events, or admin views.
    allergies: list[str] = Field(default_factory=list)
    allergy_notes: str | None = None
    dietary_restrictions: list[str] = Field(default_factory=list)
    cuisine_likes: list[str] = Field(default_factory=list)
    cuisine_dislikes: list[str] = Field(default_factory=list)
    atmosphere_preferences: list[str] = Field(default_factory=list)
    preference_notes: str | None = None
    notification_preferences: NotificationPreferences = Field(default_factory=NotificationPreferences)


class UserProfilePatch(BaseModel):
    kids_ages: list[int] | None = None
    home_lat: float | None = None
    home_lng: float | None = None
    home_label: str | None = Field(None, max_length=120)
    timezone: str | None = Field(None, max_length=64)
    allergies: list[str] | None = Field(None, max_length=32)
    allergy_notes: str | None = Field(None, max_length=500)
    dietary_restrictions: list[str] | None = Field(None, max_length=32)
    cuisine_likes: list[str] | None = Field(None, max_length=32)
    cuisine_dislikes: list[str] | None = Field(None, max_length=32)
    atmosphere_preferences: list[str] | None = Field(None, max_length=32)
    preference_notes: str | None = Field(None, max_length=500)
    complete_onboarding: bool = False


class NotificationPreferencesUpdate(BaseModel):
    cadence: Literal["weekly", "daily", "realtime_bundle"] | None = None
    quiet_hours_start: str | None = None
    quiet_hours_end: str | None = None
    alert_new_ttf: bool | None = None
    alert_new_rating: bool | None = None
    alert_new_note: bool | None = None
    alert_every_review: bool | None = None
    push_enabled: bool | None = None


class ActivityEventItem(BaseModel):
    id: UUID
    restaurant_id: UUID
    restaurant_name: str
    event_type: Literal["ttf", "attribute", "note", "profile_match"]
    source_id: UUID
    headline: str
    created_at: datetime


class ActivityInboxResponse(BaseModel):
    items: list[ActivityEventItem]
    total: int
    limit: int
    offset: int
    unread_count: int


class ActivityUnreadCountResponse(BaseModel):
    unread_count: int


class ActivityMarkReadRequest(BaseModel):
    through: datetime


class WatchedRestaurantEntry(BaseModel):
    restaurant: RestaurantMapEntry
    watched_at: datetime


class WatchedRestaurantsResponse(BaseModel):
    items: list[WatchedRestaurantEntry]
    total: int
    limit: int
    offset: int


class FamilyMatchRequest(BaseModel):
    restaurant_ids: list[UUID] = Field(min_length=1, max_length=100)


class FamilyMatchResult(BaseModel):
    matches: bool
    reasons: list[str]


class FamilyMatchResponse(BaseModel):
    # Keyed by restaurant id (string form — pydantic dict keys must be str).
    results: dict[str, FamilyMatchResult]


class DevicePushTokenRequest(BaseModel):
    platform: Literal["web", "ios"]
    token: str = Field(min_length=1, max_length=4096)


class DevicePushTokenResponse(BaseModel):
    id: UUID
    platform: Literal["web", "ios"]
    created_at: datetime
    last_seen_at: datetime


class DeleteAccountRequest(BaseModel):
    confirm: bool = Field(
        ...,
        description="Must be true to confirm permanent account deletion.",
    )
    apple_authorization_code: str | None = Field(
        default=None,
        description=(
            "Fresh Sign in with Apple authorization code from client re-auth. "
            "Used to revoke Apple tokens per App Store requirements."
        ),
    )

    @model_validator(mode="after")
    def require_confirm(self) -> "DeleteAccountRequest":
        if not self.confirm:
            raise ValueError("confirm must be true")
        return self


class UserTtfContribution(BaseModel):
    kind: Literal["ttf"] = "ttf"
    id: UUID
    restaurant_id: UUID
    restaurant_name: str
    submitted_at: datetime
    elapsed_minutes: int
    item_type: str
    item_quality: int
    portion_size: str
    daypart: str
    party_size_kids: int
    wait_context: str | None = None


class UserAttributeContribution(BaseModel):
    kind: Literal["attribute"] = "attribute"
    id: UUID
    restaurant_id: UUID
    restaurant_name: str
    submitted_at: datetime
    metric_key: str
    metric_label: str
    value: Any
    visit_context: str | None = None


class UserNoteContribution(BaseModel):
    kind: Literal["note"] = "note"
    id: UUID
    restaurant_id: UUID
    restaurant_name: str
    submitted_at: datetime
    text: str
    tags: list[str] = Field(default_factory=list)


UserContribution = UserTtfContribution | UserAttributeContribution | UserNoteContribution


class UserContributionsResponse(BaseModel):
    items: list[UserTtfContribution | UserAttributeContribution | UserNoteContribution]
    total: int
    limit: int
    offset: int


class AttributeUpdateRequest(BaseModel):
    value: Any
    visit_context: str | None = Field(None, max_length=500)


class CreateRestaurantRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(min_length=1, max_length=500)
    lat: float
    lng: float
    google_place_id: str | None = None
    google_maps_url: HttpUrl | None = None
    cuisine_tags: list[str] = Field(default_factory=list)

    @field_validator("google_place_id")
    @classmethod
    def _validate_google_place_id(cls, v: str | None) -> str | None:
        if v is None:
            return v
        try:
            return validate_and_quote_place_id(v)
        except ValueError as exc:
            raise ValueError(f"invalid google_place_id: {exc}") from exc

    @field_validator("cuisine_tags", mode="before")
    @classmethod
    def _validate_cuisine_tags(cls, v: list[str] | None) -> list[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            raise ValueError("cuisine_tags must be a list")
        if len(v) > 50:
            raise ValueError("too many cuisine_tags")
        normalized: list[str] = []
        for raw in v:
            if not isinstance(raw, str) or not raw.strip():
                raise ValueError("cuisine_tags must be non-empty strings")
            tag = raw.strip().lower()
            if len(tag) > 50 or not re.match(r"^[a-z0-9\-]+$", tag):
                raise ValueError(f"invalid cuisine_tag: {raw}")
            normalized.append(tag)
        return normalized


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
    pending_review: bool = False


class AttributeSubmissionRequest(BaseModel):
    metric_key: str
    value: Any
    visit_context: str | None = Field(None, max_length=500)


class AttributeSubmissionResponse(BaseModel):
    id: UUID
    metric_key: str
    pending_review: bool = False


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
    pending_review: bool = False


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
    trust_level: str | None = None
    auto_publish: bool | None = None
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
    pending_moderation_count: int = 0
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
    excluded_from_aggregate: bool = False
    exclusion_reason: str | None = None
    moderation_status: str = "approved"
    restaurant_median_minutes: float | None = None


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


class AdminAttentionStats(BaseModel):
    pending_moderation: int
    escalated: int
    flagged_observations: int
    restricted_users: int
    new_contributors_active: int
    stale_review_count: int


class ModerationSettingsResponse(BaseModel):
    moderation_enabled: bool
    moderation_auto_flag_urls_in_notes: bool
    moderation_auto_flag_ttf_outlier_z: float
    moderation_new_user_hold: bool


class ModerationReviewRequest(BaseModel):
    review_notes: str | None = None


class ModerationItemRow(BaseModel):
    id: UUID
    content_type: Literal["note", "ttf_observation", "attribute_rating", "ai_draft"]
    content_id: UUID
    restaurant_id: UUID
    restaurant_name: str | None = None
    firebase_uid: str
    author_email: str | None = None
    author_trust_level: str | None = None
    status: Literal["pending", "approved", "rejected", "escalated", "removed"]
    visibility: Literal["hidden", "public", "removed"]
    source: Literal["user_submit", "auto_flag", "user_report", "admin_escalation"]
    flag_reasons: list[str]
    report_count: int
    preview_text: str | None = None
    created_at: datetime
    reviewed_at: datetime | None = None


class ModerationListResponse(BaseModel):
    items: list[ModerationItemRow]
    total: int
    limit: int
    offset: int


class ObservationExcludeRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class AdminRestaurantDetail(BaseModel):
    id: UUID
    name: str
    address: str
    lat: float
    lng: float
    cuisine_tags: list[str]
    status: Literal["active", "closed", "outside_area", "tombstoned"]
    tombstone_reason: str | None = None
    google_place_id: str | None = None
    ttf_sample_size: int
    ttf_median_minutes: float | None = None
    note_count: int
    pending_moderation_count: int
    updated_at: datetime


class AdminRestaurantUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    address: str | None = Field(default=None, min_length=1, max_length=500)
    lat: float | None = None
    lng: float | None = None
    cuisine_tags: list[str] | None = None
    status: Literal["active", "closed", "outside_area", "tombstoned"] | None = None


class AdminRestaurantMergeRequest(BaseModel):
    source_id: UUID
    target_id: UUID
    reason: str = Field(min_length=1, max_length=500)


class AdminContributorDetail(BaseModel):
    firebase_uid: str
    email: str | None = None
    display_name: str | None = None
    disabled: bool | None = None
    auth_account_exists: bool = False
    trust_level: str
    auto_publish: bool
    trust_notes: str | None = None
    watch_count: int
    ttf_count: int
    attribute_count: int
    note_count: int
    total_contributions: int
    last_active_at: datetime | None = None


class AdminTrustUpdate(BaseModel):
    trust_level: Literal["new", "standard", "trusted", "restricted"] | None = None
    trust_notes: str | None = None


class ContentReportRequest(BaseModel):
    content_type: Literal["note", "ttf_observation", "attribute_rating"]
    content_id: UUID
    reason: str = Field(min_length=1, max_length=200)
    details: str | None = Field(default=None, max_length=2000)


class ContentReportResponse(BaseModel):
    id: UUID
    queued: bool = True


# --- Places autocomplete & resolve ---


class PlaceSuggestion(BaseModel):
    type: Literal["place", "restaurant"]
    place_id: str | None = None
    restaurant_id: UUID | None = None
    primary_text: str
    secondary_text: str | None = None
    lat: float | None = None
    lng: float | None = None


class AutocompleteResponse(BaseModel):
    suggestions: list[PlaceSuggestion]


class PlaceResolveResponse(BaseModel):
    place_id: str
    lat: float
    lng: float
    label: str


class PlacePracticalResponse(BaseModel):
    place_id: str
    open_now: bool | None = None
    hours_summary: str | None = None
    weekday_hours: list[str] | None = None
    phone: str | None = None
    website: str | None = None
    google_maps_url: str | None = None
    google_rating: float | None = None
    google_rating_count: int | None = None
    business_status: str | None = None
