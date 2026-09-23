"""Cancellation must cross the yt-dlp adapter without becoming success."""

from threading import Event

import pytest
from yt_dlp.utils import DownloadCancelled

from app.services import download_service


@pytest.mark.parametrize("checkpoint", ["progress_hooks", "postprocessor_hooks", "return"])
def test_adapter_cancellation_checkpoints(monkeypatch, tmp_path, checkpoint):
    signal = Event()

    class FakeDownloader:
        def __init__(self, options):
            self.options = options

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            pass

        def download(self, _urls):
            signal.set()
            if checkpoint != "return":
                self.options[checkpoint][0]({"status": "downloading"})
            return 0

    monkeypatch.setattr(download_service, "YoutubeDL", FakeDownloader)
    with pytest.raises(DownloadCancelled):
        download_service.download_playlist(
            "https://youtu.be/abc12345678", tmp_path, lambda _: None, cancel_event=signal,
        )


def test_pre_cancelled_download_does_not_create_output(tmp_path):
    signal = Event()
    signal.set()
    target = tmp_path / "not-created"
    with pytest.raises(DownloadCancelled):
        download_service.download_playlist(
            "https://youtu.be/abc12345678", target, lambda _: None, cancel_event=signal,
        )
    assert not target.exists()
