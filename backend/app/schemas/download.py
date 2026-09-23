"""Request and response models for persistent download jobs."""

from typing import Literal
from datetime import datetime

from pydantic import BaseModel, Field

FormatPreset = Literal["best", "1080p", "720p", "480p", "audio"]


class CreateDownloadRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    output_directory: str = Field(default=".", min_length=1, max_length=2048)
    format_preset: FormatPreset = "best"
    video_ids: list[str] | None = None


class DownloadItemResponse(BaseModel):
    id: int
    video_id: str | None
    title: str
    playlist_index: int | None
    status: str
    progress: float
    downloaded_bytes: int
    total_bytes: int | None
    speed: float | None
    eta: float | None
    output_path: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class DownloadJobResponse(BaseModel):
    id: str
    playlist_title: str | None
    status: str
    total_items: int
    completed_items: int
    failed_items: int
    output_directory: str
    format_preset: str
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    error_message: str | None
    items: list[DownloadItemResponse]
