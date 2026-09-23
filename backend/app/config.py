"""Environment-backed application settings."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{(PROJECT_ROOT / 'data' / 'app.db').as_posix()}"

    model_config = SettingsConfigDict(env_prefix="YTDL_", env_file=".env", extra="ignore")


settings = Settings()
