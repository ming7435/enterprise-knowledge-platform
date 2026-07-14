import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.v1 import auth, modules, workspaces
from app.core.config import Settings, get_settings
from app.core.limiter import limiter
from app.db.session import create_session_factory
from app.models.entities import Base

logger = logging.getLogger("ekp.access")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """在所有响应上注入企业级安全头。"""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """结构化请求日志：request_id、方法、路径、状态码、耗时。"""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.perf_counter()
        try:
            response: Response = await call_next(request)
        except Exception:
            logger.exception(
                "unhandled error",
                extra={"request_id": request_id, "path": request.url.path},
            )
            raise
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "%s %s %s %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            extra={"request_id": request_id},
        )
        response.headers["X-Request-Id"] = request_id
        return response


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    Path(app_settings.local_storage_root).mkdir(parents=True, exist_ok=True)
    session_factory, engine = create_session_factory(app_settings.database_url)
    Base.metadata.create_all(bind=engine)
    ensure_runtime_indexes(engine)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = app_settings
        app.state.SessionLocal = session_factory
        app.state.engine = engine

        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s %(levelname)s %(name)s %(message)s",
        )
        logger.info(
            "企业知识平台启动完成 env=%s port=%s",
            app_settings.app_env,
            app_settings.api_port,
        )
        # 启动时执行一次审计日志过期清理
        _prune_audit_logs(session_factory, app_settings)
        yield
        engine.dispose()
        logger.info("数据库连接池已释放，应用关闭。")

    app = FastAPI(title="企业知识平台", version="0.1.0", lifespan=lifespan)
    app.state.settings = app_settings
    app.state.SessionLocal = session_factory
    app.state.engine = engine

    # 挂载限流器状态和超限异常处理器
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestLoggingMiddleware)

    allowed_origins = [
        f"http://127.0.0.1:{app_settings.frontend_port}",
        f"http://localhost:{app_settings.frontend_port}",
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
        expose_headers=["X-Request-Id"],
    )

    @app.get("/health", include_in_schema=False)
    def health():
        return {"status": "ok"}

    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(workspaces.router, prefix="/api/v1")
    app.include_router(modules.router, prefix="/api/v1")
    return app


def _prune_audit_logs(session_factory, settings) -> None:
    """启动时按保留天数清理过期审计日志。0 表示不清理。"""
    if settings.audit_log_retention_days <= 0:
        return
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import delete
    from app.models.entities import AuditLog
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.audit_log_retention_days)
    db = session_factory()
    try:
        result = db.execute(
            delete(AuditLog).where(AuditLog.created_at < cutoff)
        )
        db.commit()
        if result.rowcount:
            logger.info("审计日志自动清理：删除 %d 条超过 %d 天的记录", result.rowcount, settings.audit_log_retention_days)
    except Exception:
        db.rollback()
        logger.exception("审计日志自动清理失败")
    finally:
        db.close()


def ensure_runtime_indexes(engine) -> None:
    with engine.begin() as connection:
        _ensure_documents_deleted_at_column(connection)
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
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS "
                "ix_documents_ws_parse ON documents (workspace_id, parse_status)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS "
                "ix_documents_ws_deleted ON documents (workspace_id, deleted_at)"
            )
        )


def _ensure_documents_deleted_at_column(connection) -> None:
    dialect = connection.dialect.name
    if dialect == "sqlite":
        columns = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(documents)").fetchall()
        }
        if "deleted_at" not in columns:
            connection.execute(text("ALTER TABLE documents ADD COLUMN deleted_at DATETIME"))
        return
    if dialect == "postgresql":
        connection.execute(
            text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE")
        )


app = create_app()
