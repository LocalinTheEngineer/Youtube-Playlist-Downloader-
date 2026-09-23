"""Persistent download-job model."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class JobStatus(StrEnum):
    QUEUED = "queued"
    INSPECTING = "inspecting"
    DOWNLOADING = "downloading"
    POSTPROCESSING = "postprocessing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    INTERRUPTED = "interrupted"


class DownloadJob(Base):
    __tablename__ = "download_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    playlist_id: Mapped[str | None] = mapped_column(String(128))
    playlist_title: Mapped[str | None] = mapped_column(String(512))
    output_directory: Mapped[str] = mapped_column(Text, nullable=False)
    format_preset: Mapped[str] = mapped_column(String(32), nullable=False, default="best")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=JobStatus.QUEUED.value, index=True)
    total_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)

    items: Mapped[list["DownloadItem"]] = relationship(
        back_populates="job", cascade="all, delete-orphan", passive_deletes=True
    )
