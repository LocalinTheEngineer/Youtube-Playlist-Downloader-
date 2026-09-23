"""Mocked tests for download job creation and queue processing."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import download_routes
from app.database import Base, get_session
from app.main import app
from app.models import DownloadItem, DownloadJob, JobStatus


@pytest.fixture
def session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    yield factory
    engine.dispose()


@pytest.fixture
def client(session_factory) -> Generator[TestClient, None, None]:
    def override_session():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_create_download_persists_job_and_queues_it(client, monkeypatch):
    monkeypatch.setattr(
        download_routes,
        "inspect_media",
        lambda _url: {
            "id": "PLexample",
            "playlist_id": "PLexample",
            "title": "Example playlist",
            "entries": [
                {"id": "abc12345678", "title": "First video", "playlist_index": 3},
                {"id": "def12345678", "title": "Second video", "playlist_index": 4},
            ],
        },
    )
    enqueued = []

    async def record_queue(job_id):
        enqueued.append(job_id)

    monkeypatch.setattr(download_routes, "enqueue_download", record_queue)

    response = client.post(
        "/api/downloads",
        json={
            "url": "https://www.youtube.com/playlist?list=PLexample",
            "video_ids": ["def12345678"],
            "format_preset": "720p",
        },
    )

    assert response.status_code == 202, response.text
    body = response.json()
    assert body["status"] == "queued"
    assert body["total_items"] == 1
    assert body["items"][0]["video_id"] == "def12345678"
    assert body["items"][0]["playlist_index"] == 4
    assert enqueued == [body["id"]]


def test_create_download_rejects_bad_host_and_path_traversal(client, monkeypatch):
    monkeypatch.setattr(
        download_routes,
        "inspect_media",
        lambda _url: pytest.fail("invalid host must be rejected before extraction"),
    )
    bad_host = client.post(
        "/api/downloads",
        json={"url": "https://youtube.com.evil.net/watch?v=abc12345678"},
    )
    path_traversal = client.post(
        "/api/downloads",
        json={
            "url": "https://www.youtube.com/watch?v=abc12345678",
            "output_directory": "..\\outside",
        },
    )
    assert bad_host.status_code == 400
    assert path_traversal.status_code == 400


def test_worker_processes_persisted_job_and_progress(session_factory, monkeypatch, tmp_path):
    import app.workers.download_worker as worker

    monkeypatch.setattr(worker, "SessionLocal", session_factory)
    with session_factory() as session:
        job = DownloadJob(
            source_url="https://www.youtube.com/playlist?list=PLexample",
            output_directory=str(tmp_path),
            format_preset="best",
            status=JobStatus.QUEUED.value,
            total_items=1,
            items=[DownloadItem(video_id="abc12345678", title="Example video")],
        )
        session.add(job)
        session.commit()
        job_id = job.id

    def mocked_download(url, output_dir, progress_hook, preset):
        assert url.endswith("abc12345678")
        assert preset == "best"
        progress_hook(
            {
                "status": "downloading",
                "downloaded_bytes": 50,
                "total_bytes": 100,
                "speed": 10,
                "eta": 5,
            }
        )
        progress_hook({"status": "finished", "filename": str(output_dir / "item.mp4")})
        return 0

    monkeypatch.setattr(worker, "download_playlist", mocked_download)
    worker.DownloadQueue()._process_job(job_id)

    with session_factory() as session:
        persisted_job = session.get(DownloadJob, job_id)
        item = persisted_job.items[0]
        assert persisted_job.status == JobStatus.COMPLETED.value
        assert persisted_job.completed_items == 1
        assert item.status == "completed"
        assert item.progress == 100.0
        assert item.downloaded_bytes == 50
        assert item.output_path.endswith("item.mp4")


def test_job_query_endpoints_and_terminal_sse(session_factory, client, monkeypatch):
    monkeypatch.setattr(download_routes, "SessionLocal", session_factory)
    with session_factory() as session:
        job = DownloadJob(
            source_url="https://www.youtube.com/watch?v=abc12345678",
            output_directory="downloads",
            status=JobStatus.COMPLETED.value,
            total_items=1,
            completed_items=1,
            items=[
                DownloadItem(
                    video_id="abc12345678",
                    title="Example video",
                    status="completed",
                    progress=100,
                )
            ],
        )
        session.add(job)
        session.commit()
        job_id = job.id

    detail = client.get(f"/api/downloads/{job_id}")
    history = client.get("/api/downloads")
    events = client.get(f"/api/downloads/{job_id}/events")

    assert detail.status_code == 200
    assert detail.json()["items"][0]["progress"] == 100
    assert history.status_code == 200
    assert any(entry["id"] == job_id for entry in history.json())
    assert events.status_code == 200
    assert "event: progress" in events.text
    assert '"status": "completed"' in events.text
