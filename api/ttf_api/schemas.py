from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


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


class RestaurantDetailResponse(BaseModel):
    restaurant: RestaurantDetail
    ttf: TtfAggregate = Field(default_factory=TtfAggregate)
