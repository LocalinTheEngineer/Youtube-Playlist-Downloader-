"""Read-only diagnostics for the local backend environment."""

from fastapi import APIRouter

from app.schemas.system import SystemCheck
from app.services.system_service import check_system

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/check", response_model=SystemCheck)
def system_check() -> SystemCheck:
    # A normal synchronous endpoint runs the bounded probes off the event loop.
    return check_system()
