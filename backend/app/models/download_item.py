"""Persistent per-video download item model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DownloadItem(Base):
    __tablename__ = "download_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("download_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    video_id: Mapped[str | None] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    playlist_index: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued", index=True)
    progress: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    downloaded_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_bytes: Mapped[int | None] = mapped_column(Integer)
    speed: Mapped[float | None] = mapped_column(Float)
    eta: Mapped[float | None] = mapped_column(Float)
    output_path: Mapped[str | None] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    job: Mapped["DownloadJob"] = relationship(back_populates="items")
