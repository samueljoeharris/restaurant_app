import json
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://ttf_app:ttf_local@postgres:5432/ttf"
    pilot_city: str = "dedham-ma"
    pilot_display_name: str = "Dedham, Massachusetts"
    maps_api_key: str = ""
    restaurant_seed_default_lat: float = 42.2418
    restaurant_seed_default_lng: float = -71.1662
    restaurant_seed_default_radius_m: int = 8000
    restaurant_seed_cooldown_hours: int = 24
    restaurant_seed_refresh_queries: list[str] = [
        "restaurants in Dedham Massachusetts",
        "family restaurants Dedham MA",
        "pizza Dedham MA",
        "breakfast Dedham Massachusetts",
    ]
    firebase_project_id: str = "ttf-restaurant-dev"
    firebase_service_account_path: str = ""
    firebase_auth_emulator_host: str = ""
    auth_dev_mode: bool = False
    auth_dev_admin_uids: str = ""
    cors_origins: list[str] = []
    port: int = 8080
    app_check_enforce: bool = False
    rate_limit_max_writes: int = 60
    rate_limit_window_minutes: int = 60
    # IAP JWT audience for /v1/admin/firebase-session (numeric backend id resolved at runtime).
    iap_jwt_audience: str = ""
    iap_admin_backend_service: str = ""
    gcp_project_number: str = ""
    restaurant_seed_pubsub_topic: str = ""
    internal_job_secret: str = ""
    gcp_region: str = "us-central1"
    restaurant_refresh_scheduler_job: str = ""
    cloud_run_api_service: str = "ttf-api"
    restaurant_seed_pubsub_subscription: str = "ttf-restaurant-seed-worker"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> list[str]:
        if value is None or value == "":
            return []
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            return json.loads(value)
        return []

    @field_validator("restaurant_seed_refresh_queries", mode="before")
    @classmethod
    def parse_seed_queries(cls, value: Any) -> list[str]:
        if value is None or value == "":
            return []
        if isinstance(value, list):
            return [str(item) for item in value]
        if isinstance(value, str):
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        return []


settings = Settings()
