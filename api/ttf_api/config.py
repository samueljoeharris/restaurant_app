from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://ttf_app:ttf_local@postgres:5432/ttf"
    pilot_city: str = "dedham-ma"
    pilot_display_name: str = "Dedham, Massachusetts"
    port: int = 8080


settings = Settings()
