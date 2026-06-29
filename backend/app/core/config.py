from dataclasses import dataclass
import os


@dataclass(slots=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "local")
    api_host: str = os.getenv("API_HOST", "127.0.0.1")
    api_port: int = int(os.getenv("API_PORT", "9520"))
    frontend_port: int = int(os.getenv("FRONTEND_PORT", "9521"))
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./storage/dev.db")
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "dev-only-change-me")
    jwt_access_token_expire_minutes: int = int(
        os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "120")
    )
    local_storage_root: str = os.getenv("LOCAL_STORAGE_ROOT", "storage/uploads")
    rerank_model_path: str = os.getenv(
        "RERANK_MODEL_PATH", r"L:\RAG_系统\models"
    )


def get_settings() -> Settings:
    return Settings()
