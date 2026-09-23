"""Command-line entry point for the local download engine."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from app.services.download_service import download_playlist
from app.services.url_validator import validate_youtube_url


def _progress_hook(data: dict[str, Any]) -> None:
    status = data.get("status")
    if status == "downloading":
        total = data.get("total_bytes") or data.get("total_bytes_estimate")
        downloaded = data.get("downloaded_bytes", 0)
        percent = f"{downloaded / total * 100:5.1f}%" if total else "  ... "
        speed = data.get("speed")
        eta = data.get("eta")
        speed_text = f"{speed / 1_000_000:.2f} MB/s" if speed else "? MB/s"
        eta_text = f"ETA {eta}s" if eta is not None else "ETA ?"
        print(f"\r{percent}  {speed_text}  {eta_text}", end="", flush=True)
    elif status == "finished":
        print("\nİndirme tamamlandı; son işlemler yapılıyor...", flush=True)
    elif status == "error":
        print("\nBu video indirilemedi; playlist akışı devam edecek.", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="İzinli YouTube video veya playlist içeriklerini yerel klasöre indirir."
    )
    parser.add_argument("url", help="YouTube video veya playlist bağlantısı")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("downloads"),
        help="İndirilecek dosyaların kök klasörü (varsayılan: downloads)",
    )
    args = parser.parse_args()

    try:
        url = validate_youtube_url(args.url)
    except ValueError as exc:
        parser.error(str(exc))

    result = download_playlist(url, args.output_dir, _progress_hook)
    if result:
        print("Bazı videolar indirilemedi; ayrıntı için yt-dlp çıktısını kontrol edin.")
    return result


if __name__ == "__main__":
    raise SystemExit(main())

