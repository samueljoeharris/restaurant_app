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
    firebase_project_id: str = "ttf-restaurant-dev"
    firebase_service_account_path: str = ""
    firebase_auth_emulator_host: str = ""
    auth_dev_mode: bool = False
    cors_origins: list[str] = []
    port: int = 8080
    app_check_enforce: bool = False
    rate_limit_max_writes: int = 60
    rate_limit_window_minutes: int = 60

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


settings = Settings()
