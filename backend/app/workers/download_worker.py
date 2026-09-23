"""Single-consumer asyncio queue backed by persisted download jobs."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

from app.database import SessionLocal
from app.models import DownloadItem, DownloadJob, JobStatus
from app.services.download_service import download_playlist

logger = logging.getLogger(__name__)


class DownloadQueue:
    """Process queued jobs one at a time; item downloads run off the event loop."""

    def __init__(self) -> None:
        self._queue: asyncio.Queue[str | None] = asyncio.Queue()
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if self._task is None or self._task.done():
            self._queue = asyncio.Queue()
            self._task = asyncio.create_task(self._run(), name="download-worker")

    async def stop(self) -> None:
        if self._task is None:
            return
        await self._queue.join()
        await self._queue.put(None)
        await self._task
        self._task = None

    async def enqueue(self, job_id: str) -> None:
        await self._queue.put(job_id)

    async def _run(self) -> None:
        while True:
            job_id = await self._queue.get()
            try:
                if job_id is None:
                    return
                await asyncio.to_thread(self._process_job, job_id)
            except Exception:
                logger.exception("Download worker encountered an unexpected error")
            finally:
                self._queue.task_done()

    def _process_job(self, job_id: str) -> None:
        with SessionLocal() as session:
            job = session.get(DownloadJob, job_id)
            if job is None or job.status != JobStatus.QUEUED.value:
                return
            job.status = JobStatus.DOWNLOADING.value
            job.started_at = datetime.now(timezone.utc)
            session.commit()
            work = [
                (item.id, item.video_id, item.title)
                for item in job.items
            ]
            source_root = Path(job.output_directory)
            format_preset = job.format_preset

        completed = 0
        failed = 0
        for item_id, video_id, _title in work:
            if not video_id:
                self._set_item_failed(item_id, "Video kimliği alınamadı.")
                failed += 1
                continue

            url = f"https://www.youtube.com/watch?v={video_id}"
            last_write = 0.0

            def progress_hook(data: dict, current_item: int = item_id) -> None:
                nonlocal last_write
                now = time.monotonic()
                status = data.get("status")
                if status != "downloading" and status != "finished" and status != "error":
                    return
                if status == "downloading" and now - last_write < 1.0:
                    return
                last_write = now
                with SessionLocal() as progress_session:
                    item = progress_session.get(DownloadItem, current_item)
                    if item is None:
                        return
                    if status == "downloading":
                        item.status = "downloading"
                        downloaded = int(data.get("downloaded_bytes") or 0)
                        total = data.get("total_bytes") or data.get("total_bytes_estimate")
                        item.downloaded_bytes = downloaded
                        item.total_bytes = int(total) if total else None
                        item.progress = min(100.0, downloaded * 100 / total) if total else 0.0
                        item.speed = data.get("speed")
                        item.eta = data.get("eta")
                        job = progress_session.get(DownloadJob, item.job_id)
                        if job is not None:
                            job.status = JobStatus.DOWNLOADING.value
                    elif status == "finished":
                        item.status = "postprocessing"
                        item.progress = 100.0
                        item.output_path = data.get("filename")
                        job = progress_session.get(DownloadJob, item.job_id)
                        if job is not None:
                            job.status = JobStatus.POSTPROCESSING.value
                    else:
                        item.status = "failed"
                        item.error_message = "Bu video indirilemedi."
                    progress_session.commit()

            try:
                result = download_playlist(url, source_root, progress_hook, format_preset)
            except Exception:
                logger.exception("A download item failed")
                self._set_item_failed(item_id, "İndirme sırasında beklenmeyen bir hata oluştu.")
                failed += 1
                continue

            if result:
                self._set_item_failed(item_id, "yt-dlp videoyu indiremedi.")
                failed += 1
            else:
                self._set_item_completed(item_id)
                completed += 1

        with SessionLocal() as session:
            job = session.get(DownloadJob, job_id)
            if job is None:
                return
            job.completed_items = completed
            job.failed_items = failed
            job.status = JobStatus.FAILED.value if failed else JobStatus.COMPLETED.value
            job.finished_at = datetime.now(timezone.utc)
            if failed:
                job.error_message = f"{failed} video indirilemedi."
            session.commit()

    @staticmethod
    def _set_item_failed(item_id: int, message: str) -> None:
        with SessionLocal() as session:
            item = session.get(DownloadItem, item_id)
            if item is not None:
                was_failed = item.status == "failed"
                item.status = "failed"
                item.error_message = message
                if not was_failed:
                    job = session.get(DownloadJob, item.job_id)
                    if job is not None:
                        job.failed_items += 1
                session.commit()

    @staticmethod
    def _set_item_completed(item_id: int) -> None:
        with SessionLocal() as session:
            item = session.get(DownloadItem, item_id)
            if item is not None:
                was_completed = item.status == "completed"
                item.status = "completed"
                item.progress = 100.0
                if not was_completed:
                    job = session.get(DownloadJob, item.job_id)
                    if job is not None:
                        job.completed_items += 1
                session.commit()


download_queue = DownloadQueue()
