import asyncio
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from . import models  # noqa: F401 - registers every table on Base.metadata
from .config import get_settings
from .database import Base, engine
from .media import UPLOAD_ROOT
from .realtime import hub
from .routers import auth, books, clubs, community, notifications, personal, ws


def _add_email_column() -> None:
    """create_all does not alter existing tables; add users.email to databases created before email login."""
    if "email" in {col["name"] for col in inspect(engine).get_columns("users")}:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(255)"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)"))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # create_all is for development and SQLite. Production Postgres should use Alembic migrations.
    Base.metadata.create_all(bind=engine)
    _add_email_column()
    hub.loop = asyncio.get_running_loop()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="The Book Club API", version="2.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    api = APIRouter(prefix="/api")
    for router in (
        auth.router,
        books.router,
        books.review_router,
        personal.router,
        clubs.router,
        community.router,
        notifications.router,
    ):
        api.include_router(router)
    app.include_router(api)
    app.include_router(ws.router)
    app.mount("/uploads", StaticFiles(directory=UPLOAD_ROOT), name="uploads")

    @app.get("/api/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
