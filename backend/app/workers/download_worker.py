"""Single-consumer asyncio queue backed by persisted download jobs."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from threading import Event, RLock

from yt_dlp.utils import DownloadCancelled

from app.database import SessionLocal
from app.models import DownloadItem, DownloadJob, JobStatus
from app.services.download_service import download_playlist

logger = logging.getLogger(__name__)


class DownloadQueue:
    """Process queued jobs one at a time; item downloads run off the event loop."""

    def __init__(self) -> None:
        self._queue: asyncio.Queue[str | None] = asyncio.Queue()
        self._task: asyncio.Task[None] | None = None
        self._signals: dict[str, Event] = {}
        self._state_lock = RLock()

    async def start(self) -> None:
        if self._task is None or self._task.done():
            self._queue = asyncio.Queue()
            self._task = asyncio.create_task(self._run(), name="download-worker")

    async def stop(self) -> None:
        if self._task is None:
            return
        with self._state_lock:
            for signal in self._signals.values():
                signal.set()
        await self._queue.join()
        await self._queue.put(None)
        await self._task
        self._task = None

    async def enqueue(self, job_id: str) -> None:
        if self._task is None or self._task.done():
            raise RuntimeError("Download worker is not running")
        with self._state_lock:
            self._signals.setdefault(job_id, Event())
        await self._queue.put(job_id)

    def cancel(self, job_id: str) -> bool:
        """Return True when cancelled; False when waiting for a worker checkpoint."""
        with self._state_lock, SessionLocal() as session:
            job = session.get(DownloadJob, job_id)
            if job is None:
                raise LookupError("İndirme işi bulunamadı.")
            if job.status == JobStatus.CANCELLED.value:
                return True
            if job.status not in {"queued", "inspecting", "downloading", "postprocessing"}:
                raise ValueError("Sonlanmış bir iş iptal edilemez.")
            self._signals.setdefault(job_id, Event()).set()
            queued = job.status == JobStatus.QUEUED.value
        if queued:
            self._mark_cancelled(job_id)
        return queued

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
        with self._state_lock:
            signal = self._signals.setdefault(job_id, Event())
        try:
            self._download_job(job_id, signal)
        except DownloadCancelled:
            self._mark_cancelled(job_id)
        except Exception:
            logger.error("Download job processing failed")
            with SessionLocal() as session:
                job = session.get(DownloadJob, job_id)
                if job is not None and job.status not in {"completed", "cancelled"}:
                    job.status = JobStatus.FAILED.value
                    job.error_message = "İş işlenirken beklenmeyen bir hata oluştu."
                    job.finished_at = datetime.now(timezone.utc)
                    session.commit()
        finally:
            with self._state_lock:
                self._signals.pop(job_id, None)

    def _mark_cancelled(self, job_id: str) -> None:
        with self._state_lock, SessionLocal() as session:
            job = session.get(DownloadJob, job_id)
            if job is None or job.status in {"completed", "failed", "interrupted"}:
                return
            job.status = JobStatus.CANCELLED.value
            job.finished_at = datetime.now(timezone.utc)
            for item in job.items:
                if item.status in {"queued", "inspecting", "downloading", "postprocessing"}:
                    item.status = "cancelled"
                    item.speed = None
                    item.eta = None
            job.completed_items = sum(item.status == "completed" for item in job.items)
            job.failed_items = sum(item.status == "failed" for item in job.items)
            session.commit()

    @staticmethod
    def _check_cancelled(signal: Event) -> None:
        if signal.is_set():
            raise DownloadCancelled("İndirme iptal edildi.")

    def _download_job(self, job_id: str, signal: Event) -> None:
        with self._state_lock, SessionLocal() as session:
            job = session.get(DownloadJob, job_id)
            if job is None or job.status != JobStatus.QUEUED.value:
                return
            self._check_cancelled(signal)
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
            self._check_cancelled(signal)
            if not video_id:
                self._set_item_failed(item_id, "Video kimliği alınamadı.")
                failed += 1
                continue

            url = f"https://www.youtube.com/watch?v={video_id}"
            last_write = 0.0

            def progress_hook(data: dict, current_item: int = item_id) -> None:
                nonlocal last_write
                self._check_cancelled(signal)
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
                result = download_playlist(
                    url, source_root, progress_hook, format_preset, cancel_event=signal
                )
                self._check_cancelled(signal)
            except DownloadCancelled:
                raise
            except Exception:
                self._check_cancelled(signal)
                logger.error("A download item failed")
                self._set_item_failed(item_id, "İndirme sırasında beklenmeyen bir hata oluştu.")
                failed += 1
                continue

            if result:
                self._set_item_failed(item_id, "yt-dlp videoyu indiremedi.")
                failed += 1
            else:
                self._set_item_completed(item_id)
                completed += 1

        with self._state_lock, SessionLocal() as session:
            self._check_cancelled(signal)
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
