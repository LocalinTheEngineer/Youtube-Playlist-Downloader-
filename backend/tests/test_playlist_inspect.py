"""Tests for the metadata-only inspection API."""

from fastapi.testclient import TestClient

from app.api import playlist_routes
from app.main import app

client = TestClient(app)


def test_inspect_returns_video_metadata_without_playlist_entries(monkeypatch):
    monkeypatch.setattr(
        playlist_routes,
        "inspect_media",
        lambda url: {
            "title": "Example video",
            "channel": "Example channel",
            "webpage_url": url,
        },
    )

    response = client.post(
        "/api/media/inspect",
        json={"url": "https://www.youtube.com/watch?v=abc12345678"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "title": "Example video",
        "channel": "Example channel",
        "webpage_url": "https://www.youtube.com/watch?v=abc12345678",
        "is_playlist": False,
        "entries": [],
    }


def test_inspect_returns_flat_playlist_entries(monkeypatch):
    monkeypatch.setattr(
        playlist_routes,
        "inspect_media",
        lambda _url: {
            "title": "Example playlist",
            "uploader": "Example creator",
            "entries": [
                {"id": "abc12345678", "title": "First", "duration": 42},
                None,
            ],
        },
    )

    response = client.post(
        "/api/media/inspect",
        json={"url": "https://www.youtube.com/playlist?list=PLexample"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Example playlist"
    assert body["channel"] == "Example creator"
    assert body["is_playlist"] is True
    assert body["entries"] == [
        {"id": "abc12345678", "title": "First", "url": None, "duration": 42.0}
    ]


def test_inspect_rejects_untrusted_host_before_extraction(monkeypatch):
    def fail_if_called(_url):
        raise AssertionError("extractor must not receive an untrusted URL")

    monkeypatch.setattr(playlist_routes, "inspect_media", fail_if_called)

    response = client.post(
        "/api/media/inspect",
        json={"url": "https://youtube.com.evil.net/watch?v=abc12345678"},
    )

    assert response.status_code == 400
