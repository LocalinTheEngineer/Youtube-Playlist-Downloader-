"""Local dependency readiness report."""

from datetime import datetime

from pydantic import BaseModel


class DependencyCheck(BaseModel):
    name: str
    ready: bool
    version: str | None = None
    message: str


class SystemCheck(BaseModel):
    ready: bool
    checked_at: datetime
    components: list[DependencyCheck]
