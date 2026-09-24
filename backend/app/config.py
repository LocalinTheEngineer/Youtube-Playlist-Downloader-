"""Environment-backed application settings."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{(PROJECT_ROOT / 'data' / 'app.db').as_posix()}"
    download_root: Path = PROJECT_ROOT / "downloads"
    frontend_dist: Path | None = None
    node_path: Path | None = None

    model_config = SettingsConfigDict(env_prefix="YTDL_", env_file=".env", extra="ignore")


settings = Settings()
