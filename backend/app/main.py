"""FastAPI application entry point."""

from fastapi import FastAPI
from app.api.playlist_routes import router as playlist_router

app = FastAPI(
    title="YouTube Playlist Downloader API",
    description="Yerel makinede çalışan indirme uygulamasının API'si.",
    version="0.1.0",
)
app.include_router(playlist_router)


@app.get("/", tags=["system"])
async def root() -> dict[str, str]:
    """Expose a small health response for local startup checks."""
    return {"status": "ok", "service": "youtube-playlist-downloader"}

