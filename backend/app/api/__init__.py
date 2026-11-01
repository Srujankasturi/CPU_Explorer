from fastapi import APIRouter
from .device import router as device_router
from .analyzer import router as analyzer_router
from .pipeline import router as pipeline_router
from .bottleneck import router as bottleneck_router
from .comparison import router as comparison_router
from .what_if import router as what_if_router
from .visualizations import router as visualizations_router
from .reports import router as reports_router

api_router = APIRouter()
api_router.include_router(device_router)
api_router.include_router(analyzer_router)
api_router.include_router(pipeline_router)
api_router.include_router(bottleneck_router)
api_router.include_router(comparison_router)
api_router.include_router(what_if_router)
api_router.include_router(visualizations_router)
api_router.include_router(reports_router)

__all__ = ["api_router"]

