"""Mocked tests for download job creation and queue processing."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api import download_routes
from app.database import Base, get_session
from app.main import app
from app.models import DownloadItem, DownloadJob, JobStatus


@pytest.fixture
def session_factory(tmp_path):
    engine = create_engine(
        f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    yield factory
    engine.dispose()


@pytest.fixture
def client(session_factory, monkeypatch) -> Generator[TestClient, None, None]:
    from types import SimpleNamespace
    import app.main as application
    import app.workers.download_worker as worker

    monkeypatch.setattr(application, "SessionLocal", session_factory)
    monkeypatch.setattr(application, "check_system", lambda: SimpleNamespace(ready=True))
    monkeypatch.setattr(worker, "SessionLocal", session_factory)
    monkeypatch.setattr(download_routes, "SessionLocal", session_factory)
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

    def mocked_download(url, output_dir, progress_hook, preset, *, cancel_event):
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


def test_cancel_queued_job_is_idempotent(session_factory, client):
    with session_factory() as session:
        job = DownloadJob(
            source_url="https://youtu.be/abc12345678", output_directory="downloads",
            total_items=1, items=[DownloadItem(video_id="abc12345678", title="Queued")],
        )
        session.add(job)
        session.commit()
        job_id = job.id
    for _ in range(2):
        response = client.post(f"/api/downloads/{job_id}/cancel")
        assert response.status_code == 202
        assert response.json()["status"] == "cancelled"
    with session_factory() as session:
        job = session.get(DownloadJob, job_id)
        assert job.status == "cancelled"
        assert job.finished_at is not None
        assert job.items[0].status == "cancelled"


def test_active_cancellation_preserves_completed_items(session_factory, monkeypatch, tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    import app.workers.download_worker as worker

    monkeypatch.setattr(worker, "SessionLocal", session_factory)
    with session_factory() as session:
        job = DownloadJob(
            source_url="https://youtube.com/playlist?list=PLtest", output_directory=str(tmp_path),
            total_items=3,
            items=[DownloadItem(video_id=f"video{i}", title=f"Video {i}") for i in range(3)],
        )
        session.add(job)
        session.commit()
        job_id = job.id
    entered = Event()
    calls = []

    def fake_download(url, output_dir, hook, preset, *, cancel_event):
        calls.append(url)
        if len(calls) == 1:
            return 0
        entered.set()
        assert cancel_event.wait(5), "worker did not receive cancellation"
        hook({"status": "downloading", "downloaded_bytes": 1})
        pytest.fail("hook must stop the cancelled download")

    monkeypatch.setattr(worker, "download_playlist", fake_download)
    queue = worker.DownloadQueue()
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(queue._process_job, job_id)
        assert entered.wait(5)
        assert queue.cancel(job_id) is False
        future.result(timeout=5)
    with session_factory() as session:
        job = session.get(DownloadJob, job_id)
        assert job.status == "cancelled"
        assert job.completed_items == 1
        assert job.failed_items == 0
        assert [item.status for item in job.items] == ["completed", "cancelled", "cancelled"]
    assert len(calls) == 2


def test_retry_creates_new_job_only_for_unfinished_items(session_factory, client, monkeypatch):
    with session_factory() as session:
        original = DownloadJob(
            source_url="https://youtube.com/playlist?list=PLtest",
            output_directory=str(download_routes.DOWNLOAD_ROOT), status="failed",
            total_items=2, completed_items=1, failed_items=1,
            items=[
                DownloadItem(video_id="first", title="Complete", status="completed", progress=100),
                DownloadItem(video_id="second", title="Failed", status="failed", error_message="old"),
            ],
        )
        session.add(original)
        session.commit()
        original_id = original.id
    enqueued = []

    async def record(job_id):
        enqueued.append(job_id)

    monkeypatch.setattr(download_routes, "enqueue_download", record)
    response = client.post(f"/api/downloads/{original_id}/retry")
    assert response.status_code == 202, response.text
    new = response.json()
    assert new["id"] != original_id
    assert enqueued == [new["id"]]
    assert new["status"] == "queued"
    assert new["total_items"] == 1
    assert new["items"][0]["video_id"] == "second"
    assert new["items"][0]["error_message"] is None
    assert new["items"][0]["progress"] == 0
    with session_factory() as session:
        original = session.get(DownloadJob, original_id)
        assert original.status == "failed"
        assert original.items[1].error_message == "old"


@pytest.mark.parametrize("operation", ["cancel", "retry"])
def test_terminal_job_operations_reject_completed_and_missing(session_factory, client, operation):
    with session_factory() as session:
        job = DownloadJob(source_url="https://youtu.be/example", output_directory="downloads", status="completed")
        session.add(job)
        session.commit()
        job_id = job.id
    assert client.post(f"/api/downloads/{job_id}/{operation}").status_code == 409
    assert client.post(f"/api/downloads/missing/{operation}").status_code == 404
