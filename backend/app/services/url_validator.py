"""URL validation for the supported YouTube hostnames."""

from __future__ import annotations

from urllib.parse import urlsplit

ALLOWED_HOSTS = frozenset(
    {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtu.be",
    }
)


def validate_youtube_url(value: str) -> str:
    """Return a trimmed HTTPS URL or reject unsupported input."""
    candidate = value.strip()
    if not candidate:
        raise ValueError("YouTube bağlantısı boş olamaz.")

    try:
        parsed = urlsplit(candidate)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError as exc:
        raise ValueError("Geçerli bir YouTube bağlantısı girin.") from exc

    if (
        parsed.scheme.lower() != "https"
        or hostname is None
        or hostname.lower() not in ALLOWED_HOSTS
        or parsed.username is not None
        or parsed.password is not None
        or port is not None
    ):
        raise ValueError("Yalnızca desteklenen HTTPS YouTube bağlantıları kabul edilir.")

    return candidate

