"""Endpoints for inspecting YouTube video and playlist metadata."""

from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from yt_dlp import YoutubeDL

from app.schemas.playlist import InspectRequest, InspectResponse, MediaEntry
from app.services.url_validator import validate_youtube_url

router = APIRouter(prefix="/api/media", tags=["media"])


def _thumbnail(info: dict[str, Any]) -> str | None:
    thumbnails = info.get("thumbnails") or []
    candidate = info.get("thumbnail") or (thumbnails[-1].get("url") if thumbnails else None)
    return candidate if isinstance(candidate, str) and candidate.startswith("https://") else None


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
        if not isinstance(metadata, dict):
            raise ValueError("Metadata was not returned")
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="YouTube metadata alınamadı. Bağlantıyı ve erişilebilirliği kontrol edin.",
        ) from exc

    raw_entries = metadata.get("entries")
    entries = []
    for position, raw in enumerate(raw_entries if raw_entries is not None else [metadata], start=1):
        entry = raw or {}
        video_id = str(entry["id"]) if entry.get("id") is not None else None
        available = bool(video_id) and entry.get("availability") not in {
            "private", "premium_only", "subscriber_only", "needs_auth",
        } and (entry.get("age_limit") or 0) < 18 and entry.get("title") not in {
            "[Deleted video]", "[Private video]",
        }
        entries.append(MediaEntry(
            id=video_id,
            title=entry.get("title") or "Kullanılamayan video",
            url=f"https://www.youtube.com/watch?v={quote(video_id, safe='')}" if video_id else None,
            duration=entry.get("duration"),
            position=entry.get("playlist_index") or position,
            available=available,
            thumbnail=_thumbnail(entry),
        ))
    return InspectResponse(
        id=metadata.get("id"),
        title=metadata.get("title"),
        channel=metadata.get("channel") or metadata.get("uploader"),
        webpage_url=metadata.get("webpage_url") or request.url,
        is_playlist=raw_entries is not None,
        thumbnail=_thumbnail(metadata),
        item_count=len(entries),
        entries=entries,
    )
