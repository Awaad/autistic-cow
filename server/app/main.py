from fastapi import FastAPI

from app.api.v1 import router as v1_router
import app.domain.sessions.handlers  # noqa: F401  (dispatcher subscriptions)

app = FastAPI(title="cowgame API", version="0.1.0")
app.include_router(v1_router)
