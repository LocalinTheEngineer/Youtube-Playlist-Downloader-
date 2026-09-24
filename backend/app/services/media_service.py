"""Metadata-only YouTube inspection shared by the API and terminal UI."""

from __future__ import annotations

from typing import Any

from yt_dlp import YoutubeDL

from app.config import settings

UNAVAILABLE_STATES = frozenset(
    {"private", "premium_only", "subscriber_only", "needs_auth"}
)
UNAVAILABLE_TITLES = frozenset({"[Deleted video]", "[Private video]"})


def inspect_media(url: str) -> dict[str, Any]:
    """Extract flat metadata without downloading media."""
    node_runtime = {"path": str(settings.node_path)} if settings.node_path else {}
    options = {
        "extract_flat": "in_playlist",
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "noplaylist": False,
        "js_runtimes": {"node": node_runtime},
    }
    with YoutubeDL(options) as downloader:
        result = downloader.extract_info(url, download=False)
    if not isinstance(result, dict):
        raise ValueError("YouTube metadata döndürmedi.")
    return result


def is_entry_available(entry: dict[str, Any]) -> bool:
    """Return whether an inspected entry may be offered for download."""
    return (
        bool(entry.get("id"))
        and entry.get("availability") not in UNAVAILABLE_STATES
        and (entry.get("age_limit") or 0) < 18
        and entry.get("title") not in UNAVAILABLE_TITLES
    )
