"""Endpoints for inspecting YouTube video and playlist metadata."""

from typing import Any

from fastapi import APIRouter, HTTPException
from yt_dlp import YoutubeDL

from app.schemas.playlist import InspectRequest, InspectResponse, MediaEntry
from app.services.url_validator import validate_youtube_url

router = APIRouter(prefix="/api/media", tags=["media"])


def inspect_media(url: str) -> dict[str, Any]:
    """Extract flat metadata only; never download media in this operation."""
    options = {
        "extract_flat": "in_playlist",
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "noplaylist": False,
        "js_runtimes": {"node": {}},
    }
    with YoutubeDL(options) as downloader:
        return downloader.extract_info(url, download=False)


@router.post("/inspect", response_model=InspectResponse)
def inspect(request: InspectRequest) -> InspectResponse:
    try:
        url = validate_youtube_url(request.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        metadata = inspect_media(url)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="YouTube metadata alınamadı. Bağlantıyı ve erişilebilirliği kontrol edin.",
        ) from exc

    raw_entries = metadata.get("entries")
    entries = [
        MediaEntry(
            id=str(entry["id"]) if entry.get("id") is not None else None,
            title=entry.get("title") or entry.get("id") or "Başlıksız video",
            url=entry.get("url") or entry.get("webpage_url"),
            duration=entry.get("duration"),
        )
        for entry in (raw_entries or [])
        if entry
    ]
    return InspectResponse(
        title=metadata.get("title"),
        channel=metadata.get("channel") or metadata.get("uploader"),
        webpage_url=metadata.get("webpage_url") or request.url,
        is_playlist=raw_entries is not None,
        entries=entries,
    )
