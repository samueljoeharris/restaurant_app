import json
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://ttf_app:ttf_local@postgres:5432/ttf"
    # Opaque catalog key for the shared restaurant set (not a geographic limit).
    # Value retained to avoid a data backfill; override per environment if needed.
    pilot_city: str = "dedham-ma"
    pilot_display_name: str = "Little Scout"
    maps_api_key: str = ""
    # Neutral fallback center for scheduled refresh when no seed areas exist yet.
    restaurant_seed_default_lat: float = 42.2418
    restaurant_seed_default_lng: float = -71.1662
    restaurant_seed_default_radius_m: int = 8000
    restaurant_seed_cooldown_hours: int = 24
    # Skip Places seeding when at least this many active venues already sit in radius.
    coverage_min_restaurants: int = 8
    # Per-user cap on new coverage areas requested in a rolling 24h window.
    coverage_max_areas_per_day: int = 5
    restaurant_seed_refresh_queries: list[str] = [
        "restaurants",
        "family restaurants",
        "pizza",
        "breakfast",
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
    account_delete_recent_login_minutes: int = 5
    uploads_bucket_name: str = ""
    # Sign in with Apple — optional; enables Apple token revoke on account delete.
    apple_team_id: str = ""
    apple_key_id: str = ""
    apple_private_key: str = ""
    apple_client_id: str = "com.samueljoeharris.ttf"
    apple_sign_in_key_json: str = ""
    review_chat_enabled: bool = True
    gemini_api_key: str = ""
    # Conversational turns — plain text, keep prompt small.
    gemini_chat_model: str = "gemini-2.5-flash-lite"
    # Preview/extract — structured JSON against contribution schema.
    gemini_extract_model: str = "gemini-2.5-flash"
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
    moderation_enabled: bool = True
    moderation_auto_flag_urls_in_notes: bool = True
    moderation_auto_flag_ttf_outlier_z: float = 2.5
    moderation_new_user_hold: bool = True
    moderation_escalation_notify_email: str = ""

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
