from fastapi import APIRouter

from app.api.v1 import auth, consents, sessions, health

router = APIRouter(prefix="/api/v1")
router.include_router(health.router)
router.include_router(auth.router)
router.include_router(sessions.router)
router.include_router(consents.router)
