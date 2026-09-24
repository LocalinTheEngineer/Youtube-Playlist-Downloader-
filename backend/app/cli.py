"""Command-line entry point for the local download engine."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
from typing import Any

from app.services.download_service import download_playlist
from app.services.media_service import inspect_media, is_entry_available
from app.services.url_validator import validate_youtube_url


VIDEO_PRESETS = {
    "1": ("En yüksek uygun kalite", "best"),
    "2": ("1080p'ye kadar", "1080p"),
    "3": ("720p'ye kadar", "720p"),
    "4": ("480p'ye kadar", "480p"),
}
AUDIO_PRESETS = {
    "1": ("128 kbps MP3", "audio128"),
    "2": ("192 kbps MP3", "audio192"),
    "3": ("320 kbps MP3", "audio320"),
}


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


def _duration_text(value: Any) -> str:
    try:
        seconds = max(0, int(value))
    except (TypeError, ValueError):
        return "??:??"
    return f"{seconds // 60}:{seconds % 60:02d}"


def _parse_selection(value: str, available: set[int], total: int) -> list[int]:
    """Parse `tümü`, individual numbers, and inclusive ranges such as 2-5."""
    normalized = value.strip().lower().replace(" ", "")
    if normalized in {"tümü", "tumu", "tum", "hepsi", "all"}:
        return sorted(available)
    if not normalized:
        raise ValueError("En az bir video seçin.")

    selected: set[int] = set()
    try:
        for part in normalized.split(","):
            if not part:
                raise ValueError
            if "-" in part:
                start_text, end_text = part.split("-", 1)
                start, end = int(start_text), int(end_text)
                if start > end:
                    raise ValueError
                selected.update(range(start, end + 1))
            else:
                selected.add(int(part))
    except ValueError as exc:
        raise ValueError("Seçimi 'tümü' veya '1,3-5' biçiminde yazın.") from exc

    out_of_range = selected - set(range(1, total + 1))
    unavailable = selected - available
    if out_of_range:
        raise ValueError(f"1 ile {total} arasında sıra numarası kullanın.")
    if unavailable:
        numbers = ", ".join(str(item) for item in sorted(unavailable))
        raise ValueError(f"Şu videolar kullanılamıyor: {numbers}")
    return sorted(selected)


def _choose(prompt: str, choices: dict[str, tuple[str, str]]) -> str:
    while True:
        print(prompt)
        for number, (label, _preset) in choices.items():
            print(f"  {number}) {label}")
        answer = input("Seçiminiz: ").strip()
        if answer in choices:
            return choices[answer][1]
        print("Geçersiz seçim; listeden bir numara girin.\n")


def _choose_preset() -> str:
    media_type = _choose(
        "\nÇıktı türü:",
        {"1": ("Video (MP4)", "video"), "2": ("Yalnızca ses (MP3)", "audio")},
    )
    if media_type == "video":
        return _choose("\nVideo kalitesi:", VIDEO_PRESETS)
    return _choose("\nSes kalitesi:", AUDIO_PRESETS)


def _show_and_choose_items(metadata: dict[str, Any]) -> list[int] | None:
    raw_entries = metadata.get("entries")
    entries = list(raw_entries) if raw_entries is not None else [metadata]
    title = metadata.get("title") or "Adsız içerik"
    print(f"\nBulunan içerik: {title}")
    available: set[int] = set()
    for position, raw_entry in enumerate(entries, start=1):
        entry = raw_entry or {}
        downloadable = is_entry_available(entry)
        if downloadable:
            available.add(position)
        marker = "" if downloadable else " [kullanılamıyor]"
        entry_title = entry.get("title") or "Kullanılamayan video"
        print(f"  [{position:>3}] {_duration_text(entry.get('duration'))}  {entry_title}{marker}")

    if not available:
        raise ValueError("İndirilebilecek içerik bulunamadı.")
    if raw_entries is None:
        return None

    while True:
        answer = input("\nİndirilecekler (tümü veya örn. 1,3-5): ")
        try:
            selected = _parse_selection(answer, available, len(entries))
        except ValueError as exc:
            print(f"Hata: {exc}")
            continue
        print(f"{len(selected)} video seçildi.")
        return selected


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="İzinli YouTube video veya playlist içeriklerini yerel klasöre indirir."
    )
    parser.add_argument("url", nargs="?", help="YouTube video veya playlist bağlantısı")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("downloads"),
        help="İndirilecek dosyaların kök klasörü (varsayılan: downloads)",
    )
    args = parser.parse_args(argv)

    try:
        raw_url = args.url or input("YouTube video veya playlist bağlantısı: ")
        url = validate_youtube_url(raw_url)
    except ValueError as exc:
        parser.error(str(exc))

    try:
        print("İçerikler inceleniyor...", flush=True)
        metadata = inspect_media(url)
        selected_items = _show_and_choose_items(metadata)
        preset = _choose_preset()
    except (EOFError, KeyboardInterrupt):
        print("\nİşlem iptal edildi.")
        return 130
    except Exception as exc:
        print(f"İçerikler alınamadı: {exc}", file=sys.stderr)
        return 1

    print(f"\nİndirme başlıyor: {args.output_dir}")
    result = download_playlist(
        url,
        args.output_dir,
        _progress_hook,
        preset,
        playlist_items=selected_items,
    )
    if result:
        print("Bazı videolar indirilemedi; ayrıntı için yt-dlp çıktısını kontrol edin.")
    return result


if __name__ == "__main__":
    raise SystemExit(main())

