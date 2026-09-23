"""Request and response models for media inspection."""

from pydantic import BaseModel, Field


class InspectRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)


class MediaEntry(BaseModel):
    id: str | None = None
    title: str
    url: str | None = None
    duration: float | None = None
    position: int
    available: bool
    thumbnail: str | None = None


class InspectResponse(BaseModel):
    id: str | None = None
    title: str | None = None
    channel: str | None = None
    webpage_url: str | None = None
    is_playlist: bool
    thumbnail: str | None = None
    item_count: int
    entries: list[MediaEntry]
