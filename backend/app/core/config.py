from dataclasses import dataclass
import os
from pathlib import Path


def _load_dotenv() -> None:
    env_path = Path.cwd() / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


def _env_bool(key: str, default: str = "false") -> bool:
    return os.getenv(key, default).lower() in {"1", "true", "yes", "on"}


_load_dotenv()


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
    file_storage: str = os.getenv("FILE_STORAGE", "minio")
    llm_provider: str = os.getenv("LLM_PROVIDER", "deepseek")
    llm_model: str = os.getenv("LLM_MODEL", "deepseek-v4-flash")
    deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY", "")
    deepseek_base_url: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    deepseek_model: str = os.getenv(
        "DEEPSEEK_MODEL", os.getenv("LLM_MODEL", "deepseek-v4-flash")
    )
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen3:8b")
    rag_top_k: int = int(os.getenv("RAG_TOP_K", "5"))
    rerank_model_path: str = os.getenv(
        "RERANK_MODEL_PATH", r"L:\RAG_系统\models"
    )
    smtp_host: str = os.getenv("SMTP_HOST", "smtp.qq.com")
    smtp_port: int = int(os.getenv("SMTP_PORT", "465"))
    smtp_username: str = os.getenv("SMTP_USERNAME", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from_email: str = os.getenv("SMTP_FROM_EMAIL", smtp_username)
    smtp_from_name: str = os.getenv("SMTP_FROM_NAME", "企业知识平台")
    smtp_use_ssl: bool = _env_bool("SMTP_USE_SSL", "true")
    smtp_use_tls: bool = _env_bool("SMTP_USE_TLS", "false")
    email_code_expire_minutes: int = int(os.getenv("EMAIL_CODE_EXPIRE_MINUTES", "10"))
    email_code_resend_seconds: int = int(os.getenv("EMAIL_CODE_RESEND_SECONDS", "60"))

    n8n_url: str = os.getenv("N8N_URL", "http://localhost:5678")
    minio_endpoint: str = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
    minio_access_key: str = os.getenv("MINIO_ACCESS_KEY", "")
    minio_secret_key: str = os.getenv("MINIO_SECRET_KEY", "")
    minio_bucket: str = os.getenv("MINIO_BUCKET", "enterprise-knowledge-platform")
    minio_secure: bool = _env_bool("MINIO_SECURE", "false")
    neo4j_uri: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    mysql_host: str = os.getenv("MYSQL_HOST", "localhost")
    mysql_port: int = int(os.getenv("MYSQL_PORT", "3306"))
    redis_host: str = os.getenv("REDIS_HOST", "localhost")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    milvus_host: str = os.getenv("MILVUS_HOST", "localhost")
    milvus_grpc_port: int = int(os.getenv("MILVUS_GRPC_PORT", "19530"))
    milvus_http_port: int = int(os.getenv("MILVUS_HTTP_PORT", "9091"))
    relational_db: str = os.getenv("RELATIONAL_DB", "sqlite")
    vector_store: str = os.getenv("VECTOR_STORE", "milvus")
    graph_db: str = os.getenv("GRAPH_DB", "neo4j")


def get_settings() -> Settings:
    return Settings()
