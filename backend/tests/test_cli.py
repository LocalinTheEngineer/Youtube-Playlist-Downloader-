"""Tests for the interactive terminal workflow."""

from pathlib import Path

import pytest

from app import cli
from app.services import download_service


URL = "https://www.youtube.com/playlist?list=PLexample"


def test_parse_selection_supports_all_numbers_and_ranges():
    available = {1, 2, 4, 5}

    assert cli._parse_selection("tümü", available, 5) == [1, 2, 4, 5]
    assert cli._parse_selection("5, 1-2, 2", available, 5) == [1, 2, 5]


@pytest.mark.parametrize("selection", ["", "0", "2-1", "1,,2", "abc", "6"])
def test_parse_selection_rejects_invalid_values(selection):
    with pytest.raises(ValueError):
        cli._parse_selection(selection, {1, 2, 3}, 3)


def test_parse_selection_rejects_unavailable_video():
    with pytest.raises(ValueError, match="kullanılamıyor"):
        cli._parse_selection("2", {1, 3}, 3)


def test_interactive_cli_selects_playlist_items_and_audio_quality(monkeypatch, tmp_path, capsys):
    monkeypatch.setattr(
        cli,
        "inspect_media",
        lambda _url: {
            "title": "Example playlist",
            "entries": [
                {"id": "one", "title": "One", "duration": 61},
                {"id": "two", "title": "Two", "duration": 122},
                {"id": "three", "title": "Three", "duration": 183},
                {"id": "four", "title": "Four", "duration": 244},
            ],
        },
    )
    answers = iter(["1,3-4", "2", "3"])
    monkeypatch.setattr("builtins.input", lambda _prompt: next(answers))
    received = {}

    def fake_download(url, output_dir, progress_hook, preset, *, playlist_items):
        received.update(
            url=url,
            output_dir=output_dir,
            progress_hook=progress_hook,
            preset=preset,
            playlist_items=playlist_items,
        )
        return 0

    monkeypatch.setattr(cli, "download_playlist", fake_download)

    assert cli.main([URL, "--output-dir", str(tmp_path)]) == 0
    assert received == {
        "url": URL,
        "output_dir": Path(tmp_path),
        "progress_hook": cli._progress_hook,
        "preset": "audio320",
        "playlist_items": [1, 3, 4],
    }
    output = capsys.readouterr().out
    assert "3 video seçildi" in output
    assert "1:01  One" in output


def test_interactive_cli_skips_item_prompt_for_single_video(monkeypatch, tmp_path):
    video_url = "https://youtu.be/abc12345678"
    monkeypatch.setattr(
        cli,
        "inspect_media",
        lambda _url: {"id": "abc12345678", "title": "Single", "duration": 42},
    )
    answers = iter(["1", "3"])
    monkeypatch.setattr("builtins.input", lambda _prompt: next(answers))
    received = {}

    def fake_download(url, output_dir, progress_hook, preset, *, playlist_items):
        received.update(preset=preset, playlist_items=playlist_items)
        return 0

    monkeypatch.setattr(cli, "download_playlist", fake_download)

    assert cli.main([video_url, "--output-dir", str(tmp_path)]) == 0
    assert received == {"preset": "720p", "playlist_items": None}


def test_download_service_passes_items_and_audio_bitrate_to_ytdlp(monkeypatch, tmp_path):
    captured = {}

    class FakeYoutubeDL:
        def __init__(self, options):
            captured.update(options)

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def download(self, urls):
            assert urls == [URL]
            return 0

    monkeypatch.setattr(download_service, "YoutubeDL", FakeYoutubeDL)

    result = download_service.download_playlist(
        URL,
        tmp_path,
        lambda _data: None,
        "audio128",
        playlist_items=[1, 3, 4],
    )

    assert result == 0
    assert captured["playlist_items"] == "1,3,4"
    assert captured["postprocessors"][0]["preferredquality"] == "128"
    assert "merge_output_format" not in captured
