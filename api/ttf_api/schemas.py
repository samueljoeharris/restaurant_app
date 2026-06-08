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


class UserProfile(BaseModel):
    firebase_uid: str
    display_name: str | None = None
    email: str | None = None
    contribution_count: int


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
