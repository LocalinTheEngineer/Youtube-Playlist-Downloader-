"""Tests for the metadata-only inspection API."""

from fastapi.testclient import TestClient
import pytest

from app.api import playlist_routes
from app.main import app

client = TestClient(app)


def test_inspect_returns_single_video_as_selectable_entry(monkeypatch):
    monkeypatch.setattr(
        playlist_routes,
        "inspect_media",
        lambda url: {
            "id": "abc12345678",
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
    body = response.json()
    assert body["title"] == "Example video"
    assert body["channel"] == "Example channel"
    assert body["is_playlist"] is False
    assert body["item_count"] == 1
    assert body["entries"][0]["id"] == "abc12345678"
    assert body["entries"][0]["available"] is True


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
    assert body["item_count"] == 2
    assert body["entries"][0]["duration"] == 42.0
    assert body["entries"][0]["position"] == 1
    assert body["entries"][1]["available"] is False
    assert body["entries"][1]["position"] == 2


def test_inspect_rejects_untrusted_host_before_extraction(monkeypatch):
    def fail_if_called(_url):
        raise AssertionError("extractor must not receive an untrusted URL")

    monkeypatch.setattr(playlist_routes, "inspect_media", fail_if_called)

    response = client.post(
        "/api/media/inspect",
        json={"url": "https://youtube.com.evil.net/watch?v=abc12345678"},
    )

    assert response.status_code == 400


@pytest.mark.parametrize("metadata", [
    {"id": "abc12345678", "title": "Private", "availability": "private"},
    {"id": "abc12345678", "title": "Adult", "age_limit": 18},
    {"id": "abc12345678", "title": "[Deleted video]"},
])
def test_unavailable_entries_cannot_be_selected(monkeypatch, metadata):
    monkeypatch.setattr(playlist_routes, "inspect_media", lambda _url: metadata)
    response = client.post("/api/media/inspect", json={"url": "https://youtu.be/abc12345678"})
    assert response.status_code == 200
    assert response.json()["entries"][0]["available"] is False


def test_cors_allows_only_the_local_frontend():
    for origin, allowed in [("http://localhost:5173", True), ("https://example.com", False)]:
        response = client.options("/api/media/inspect", headers={
            "Origin": origin, "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        })
        assert (response.headers.get("access-control-allow-origin") == origin) is allowed
