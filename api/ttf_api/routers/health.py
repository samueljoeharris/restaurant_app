from fastapi import APIRouter

from ttf_api.config import settings
from ttf_api.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        pilot_city=settings.pilot_city,
        pilot_display_name=settings.pilot_display_name,
    )
