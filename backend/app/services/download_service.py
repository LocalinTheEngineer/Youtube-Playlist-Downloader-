"""yt-dlp based download engine for public, non-age-restricted content."""

from __future__ import annotations

from pathlib import Path
from threading import Event
from typing import Any, Callable

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadCancelled

from app.services.format_service import AUDIO_QUALITY, FORMAT_PRESETS
from app.services.url_validator import validate_youtube_url

ProgressHook = Callable[[dict[str, Any]], None]


def download_playlist(
    url: str,
    output_dir: Path,
    progress_hook: ProgressHook,
    format_preset: str = "best",
    cancel_event: Event | None = None,
    playlist_items: list[int] | None = None,
) -> int:
    """Download a video or playlist, continuing when an individual item fails."""
    def check_cancelled(_data=None) -> None:
        if cancel_event is not None and cancel_event.is_set():
            raise DownloadCancelled("İndirme iptal edildi.")

    def report_progress(data: dict[str, Any]) -> None:
        check_cancelled()
        progress_hook(data)

    check_cancelled()
    url = validate_youtube_url(url)
    if format_preset not in FORMAT_PRESETS:
        raise ValueError("Desteklenmeyen kalite/format seçimi.")
    output_dir = Path(output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    options: dict[str, Any] = {
        "format": FORMAT_PRESETS[format_preset],
        "age_limit": 17,
        "js_runtimes": {"node": {}},
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
        "progress_hooks": [report_progress],
        "postprocessor_hooks": [check_cancelled],
        "socket_timeout": 15,
        "retries": 3,
        "download_archive": str(output_dir / ".downloaded.txt"),
    }
    if playlist_items is not None:
        if not playlist_items or any(position < 1 for position in playlist_items):
            raise ValueError("Playlist seçimleri pozitif sıra numaraları olmalıdır.")
        options["playlist_items"] = ",".join(str(position) for position in playlist_items)

    if format_preset in AUDIO_QUALITY:
        options["postprocessors"] = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": AUDIO_QUALITY[format_preset],
            }
        ]
    else:
        options["merge_output_format"] = "mp4"

    with YoutubeDL(options) as downloader:
        result = int(downloader.download([url]) or 0)
    check_cancelled()
    return result

