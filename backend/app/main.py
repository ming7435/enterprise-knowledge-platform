from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1 import auth, modules, workspaces
from app.core.config import Settings, get_settings
from app.db.session import create_session_factory
from app.models.entities import Base


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    Path(app_settings.local_storage_root).mkdir(parents=True, exist_ok=True)
    session_factory, engine = create_session_factory(app_settings.database_url)
    Base.metadata.create_all(bind=engine)
    ensure_runtime_indexes(engine)

    app = FastAPI(title="企业知识平台", version="0.1.0")
    app.state.settings = app_settings
    app.state.SessionLocal = session_factory
    app.state.engine = engine

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            f"http://127.0.0.1:{app_settings.frontend_port}",
            f"http://localhost:{app_settings.frontend_port}",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        return {"status": "ok"}

    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(workspaces.router, prefix="/api/v1")
    app.include_router(modules.router, prefix="/api/v1")
    return app


def ensure_runtime_indexes(engine) -> None:
    with engine.begin() as connection:
        duplicate_username = connection.execute(
            text(
                """
                SELECT lower(username) AS normalized_username, COUNT(*) AS count
                FROM users
                WHERE username IS NOT NULL
                GROUP BY lower(username)
                HAVING COUNT(*) > 1
                LIMIT 1
                """
            )
        ).first()
        if duplicate_username is None:
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS "
                    "ix_users_username_lower ON users (lower(username))"
                )
            )


app = create_app()
