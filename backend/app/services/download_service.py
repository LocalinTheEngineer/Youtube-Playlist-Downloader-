"""yt-dlp based download engine for public, non-age-restricted content."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from yt_dlp import YoutubeDL

from app.services.url_validator import validate_youtube_url

ProgressHook = Callable[[dict[str, Any]], None]


def download_playlist(
    url: str,
    output_dir: Path,
    progress_hook: ProgressHook,
) -> int:
    """Download a video or playlist, continuing when an individual item fails."""
    url = validate_youtube_url(url)
    output_dir = Path(output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    options: dict[str, Any] = {
        "format": "bv*+ba/b",
        "age_limit": 17,
        "js_runtimes": {"node": {}},
        "merge_output_format": "mp4",
        "outtmpl": str(
            output_dir
            / "%(playlist_title|)s"
            / "%(playlist_index&{} - |)s%(title).150B [%(id)s].%(ext)s"
        ),
        "ignoreerrors": True,
        "continuedl": True,
        "overwrites": False,
        "noprogress": True,
        "windowsfilenames": True,
        "progress_hooks": [progress_hook],
        "download_archive": str(output_dir / ".downloaded.txt"),
    }

    with YoutubeDL(options) as downloader:
        return int(downloader.download([url]) or 0)

