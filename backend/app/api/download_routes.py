"""Create and queue persistent media download jobs."""

from pathlib import Path
import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request
from sse_starlette.sse import EventSourceResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.api.playlist_routes import inspect_media
from app.config import settings
from app.database import SessionLocal, get_session
from app.models import DownloadItem, DownloadJob, JobStatus
from app.schemas.download import (
    CreateDownloadRequest,
    DownloadJobResponse,
    DownloadItemResponse,
)
from app.services.url_validator import validate_youtube_url
from app.workers.download_worker import download_queue

router = APIRouter(prefix="/api/downloads", tags=["downloads"])
DOWNLOAD_ROOT = settings.download_root.expanduser().resolve()


def _output_path(value: str) -> Path:
    requested = Path(value).expanduser()
    candidate = requested if requested.is_absolute() else DOWNLOAD_ROOT / requested
    resolved = candidate.resolve()
    if not resolved.is_relative_to(DOWNLOAD_ROOT):
        raise HTTPException(
            status_code=400,
            detail="Çıktı klasörü yalnızca proje içindeki downloads klasörü olabilir.",
        )
    return resolved


async def enqueue_download(job_id: str) -> None:
    await download_queue.enqueue(job_id)


def _job_response(job: DownloadJob) -> DownloadJobResponse:
    return DownloadJobResponse(
        id=job.id,
        playlist_title=job.playlist_title,
        status=job.status,
        total_items=job.total_items,
        completed_items=job.completed_items,
        failed_items=job.failed_items,
        output_directory=job.output_directory,
        format_preset=job.format_preset,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        error_message=job.error_message,
        items=[
            DownloadItemResponse(
                id=item.id,
                video_id=item.video_id,
                title=item.title,
                playlist_index=item.playlist_index,
                status=item.status,
                progress=item.progress,
                downloaded_bytes=item.downloaded_bytes,
                total_bytes=item.total_bytes,
                speed=item.speed,
                eta=item.eta,
                output_path=item.output_path,
                error_message=item.error_message,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
            for item in job.items
        ],
    )


@router.post("", response_model=DownloadJobResponse, status_code=202)
async def create_download(
    request: CreateDownloadRequest,
    session: Session = Depends(get_session),
) -> DownloadJobResponse:
    try:
        url = validate_youtube_url(request.url)
        output_directory = _output_path(request.output_directory)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        from asyncio import to_thread

        metadata = await to_thread(inspect_media, url)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="İndirme öncesi YouTube metadata bilgisi alınamadı.",
        ) from exc

    raw_entries = metadata.get("entries")
    if raw_entries is None:
        raw_entries = [metadata]
    else:
        raw_entries = [entry for entry in raw_entries if entry]

    available = {
        str(entry.get("id")): entry
        for entry in raw_entries
        if entry.get("id") is not None
    }
    if request.video_ids is not None:
        if not request.video_ids:
            raise HTTPException(status_code=422, detail="En az bir video seçilmelidir.")
        if len(request.video_ids) != len(set(request.video_ids)):
            raise HTTPException(status_code=422, detail="Video listesinde tekrar eden kimlik var.")
        missing = set(request.video_ids) - set(available)
        if missing:
            raise HTTPException(status_code=422, detail="Seçilen video bu içerikte bulunamadı.")
        entries = [available[video_id] for video_id in request.video_ids]
    else:
        entries = list(available.values())

    if not entries:
        raise HTTPException(status_code=422, detail="İndirilebilir video bulunamadı.")

    output_directory.mkdir(parents=True, exist_ok=True)
    job = DownloadJob(
        source_url=url,
        playlist_id=metadata.get("playlist_id") or metadata.get("id"),
        playlist_title=metadata.get("title"),
        output_directory=str(output_directory),
        format_preset=request.format_preset,
        status=JobStatus.QUEUED.value,
        total_items=len(entries),
        items=[
            DownloadItem(
                video_id=str(entry["id"]),
                title=entry.get("title") or entry["id"],
                playlist_index=entry.get("playlist_index") or index,
                status="queued",
            )
            for index, entry in enumerate(entries, start=1)
        ],
    )
    session.add(job)
    session.commit()
    session.refresh(job)

    try:
        await enqueue_download(job.id)
    except Exception as exc:
        job.status = JobStatus.FAILED.value
        job.error_message = "İş kuyruğa eklenemedi."
        session.commit()
        raise HTTPException(status_code=503, detail="İş kuyruğu şu anda kullanılamıyor.") from exc

    return _job_response(job)


@router.get("", response_model=list[DownloadJobResponse])
def list_downloads(
    limit: int = 50,
    offset: int = 0,
    session: Session = Depends(get_session),
) -> list[DownloadJobResponse]:
    if limit < 1 or limit > 100 or offset < 0:
        raise HTTPException(status_code=422, detail="limit 1-100, offset 0 veya daha büyük olmalıdır.")
    jobs = session.scalars(
        select(DownloadJob)
        .options(selectinload(DownloadJob.items))
        .order_by(DownloadJob.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [_job_response(job) for job in jobs]


@router.post("/{job_id}/cancel", status_code=202)
async def cancel_download(job_id: str) -> dict[str, str]:
    try:
        finished = await asyncio.to_thread(download_queue.cancel, job_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"id": job_id, "status": "cancelled" if finished else "cancel_requested"}


@router.post("/{job_id}/retry", response_model=DownloadJobResponse, status_code=202)
async def retry_download(
    job_id: str, session: Session = Depends(get_session),
) -> DownloadJobResponse:
    original = session.get(DownloadJob, job_id)
    if original is None:
        raise HTTPException(status_code=404, detail="İndirme işi bulunamadı.")
    if original.status != JobStatus.FAILED.value:
        raise HTTPException(status_code=409, detail="Yalnızca başarısız işler yeniden denenebilir.")
    pending = [item for item in original.items if item.status not in {"completed", "skipped"}]
    if not pending:
        raise HTTPException(status_code=409, detail="Yeniden denenecek video bulunamadı.")
    output = _output_path(original.output_directory)
    job = DownloadJob(
        source_url=original.source_url,
        playlist_id=original.playlist_id,
        playlist_title=original.playlist_title,
        output_directory=str(output),
        format_preset=original.format_preset,
        total_items=len(pending),
        items=[
            DownloadItem(
                video_id=item.video_id, title=item.title, playlist_index=item.playlist_index,
            )
            for item in pending
        ],
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    try:
        await enqueue_download(job.id)
    except Exception as exc:
        job.status = JobStatus.FAILED.value
        job.error_message = "İş kuyruğa eklenemedi."
        session.commit()
        raise HTTPException(status_code=503, detail="İş kuyruğu şu anda kullanılamıyor.") from exc
    return _job_response(job)


@router.get("/{job_id}", response_model=DownloadJobResponse)
def get_download(job_id: str, session: Session = Depends(get_session)) -> DownloadJobResponse:
    job = session.scalar(
        select(DownloadJob)
        .options(selectinload(DownloadJob.items))
        .where(DownloadJob.id == job_id)
    )
    if job is None:
        raise HTTPException(status_code=404, detail="İndirme işi bulunamadı.")
    return _job_response(job)


@router.get("/{job_id}/events")
async def download_events(
    job_id: str,
    request: Request,
    session: Session = Depends(get_session),
) -> EventSourceResponse:
    if session.get(DownloadJob, job_id) is None:
        raise HTTPException(status_code=404, detail="İndirme işi bulunamadı.")
    session.close()

    async def event_stream() -> AsyncIterator[dict[str, str]]:
        while not await request.is_disconnected():
            with SessionLocal() as event_session:
                job = event_session.scalar(
                    select(DownloadJob)
                    .options(selectinload(DownloadJob.items))
                    .where(DownloadJob.id == job_id)
                )
                if job is None:
                    return
                payload = _job_response(job).model_dump(mode="json")
                revision = max(
                    (item.updated_at.isoformat() for item in job.items),
                    default=job.created_at.isoformat(),
                )
                terminal = job.status in {
                    JobStatus.COMPLETED.value,
                    JobStatus.FAILED.value,
                    JobStatus.CANCELLED.value,
                    JobStatus.INTERRUPTED.value,
                }
            yield {
                "event": "progress",
                "id": revision,
                "data": json.dumps(payload, ensure_ascii=False),
            }
            if terminal:
                return
            await asyncio.sleep(1)

    return EventSourceResponse(event_stream(), ping=15, send_timeout=30)
