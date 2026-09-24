"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import asyncio
import logging

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import update

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import DownloadItem, DownloadJob, JobStatus
from app.workers.download_worker import download_queue
from app.api.playlist_routes import router as playlist_router
from app.api.download_routes import router as download_router
from app.api.system_routes import router as system_router
from app.services.system_service import check_system


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Recover interrupted work, then run the single local queue worker."""
    Base.metadata.create_all(bind=engine)
    _app.state.system_check = await asyncio.to_thread(check_system)
    if not _app.state.system_check.ready:
        logging.getLogger(__name__).warning(
            "Sistem bağımlılıkları hazır değil; ayrıntılar için /api/system/check adresini açın."
        )
    now = datetime.now(timezone.utc)
    with SessionLocal.begin() as session:
        session.execute(
            update(DownloadJob)
            .where(
                DownloadJob.status.in_(
                    [
                        JobStatus.QUEUED.value,
                        JobStatus.INSPECTING.value,
                        JobStatus.DOWNLOADING.value,
                        JobStatus.POSTPROCESSING.value,
                    ]
                )
            )
            .values(
                status=JobStatus.INTERRUPTED.value,
                finished_at=now,
                error_message="Uygulama yeniden başlatıldığı için iş kesildi.",
            )
        )
        session.execute(
            update(DownloadItem)
            .where(DownloadItem.status.in_(["queued", "downloading", "postprocessing"]))
            .values(status=JobStatus.INTERRUPTED.value)
        )
    await download_queue.start()
    try:
        yield
    finally:
        await download_queue.stop()

app = FastAPI(
    title="YouTube Playlist Downloader API",
    description="Yerel makinede çalışan indirme uygulamasının API'si.",
    version="0.1.0",
    lifespan=lifespan,
)
app.include_router(playlist_router)
app.include_router(download_router)
app.include_router(system_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Expose a small health response for desktop startup checks."""
    return {"status": "ok", "service": "youtube-playlist-downloader"}


frontend_dist = settings.frontend_dist.expanduser().resolve() if settings.frontend_dist else None
if frontend_dist and (frontend_dist / "index.html").is_file():
    assets = frontend_dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="frontend-assets")

    @app.get("/", include_in_schema=False)
    async def desktop_index() -> FileResponse:
        return FileResponse(frontend_dist / "index.html")

    @app.get("/{requested_path:path}", include_in_schema=False)
    async def desktop_spa(requested_path: str) -> FileResponse:
        if requested_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Endpoint bulunamadı.")
        candidate = (frontend_dist / requested_path).resolve()
        if candidate.is_relative_to(frontend_dist) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(frontend_dist / "index.html")
else:
    @app.get("/", tags=["system"])
    async def root() -> dict[str, str]:
        return {"status": "ok", "service": "youtube-playlist-downloader"}

