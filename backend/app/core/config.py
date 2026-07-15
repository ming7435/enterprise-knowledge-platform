import os
import sys
from dataclasses import dataclass, field
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

_DEFAULT_JWT_SECRET = "dev-only-change-me"


@dataclass(slots=True)
class Settings:
    app_env: str = field(default_factory=lambda: os.getenv("APP_ENV", "local"))
    api_host: str = field(default_factory=lambda: os.getenv("API_HOST", "127.0.0.1"))
    api_port: int = field(default_factory=lambda: int(os.getenv("API_PORT", "9520")))
    frontend_port: int = field(default_factory=lambda: int(os.getenv("FRONTEND_PORT", "9521")))
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./storage/dev.db"))
    jwt_secret_key: str = field(default_factory=lambda: os.getenv("JWT_SECRET_KEY", _DEFAULT_JWT_SECRET))
    jwt_access_token_expire_minutes: int = field(
        default_factory=lambda: int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
    )
    local_storage_root: str = field(default_factory=lambda: os.getenv("LOCAL_STORAGE_ROOT", "storage/uploads"))
    file_storage: str = field(default_factory=lambda: os.getenv("FILE_STORAGE", "minio"))
    llm_provider: str = field(default_factory=lambda: os.getenv("LLM_PROVIDER", "deepseek"))
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "deepseek-v4-flash"))
    deepseek_api_key: str = field(default_factory=lambda: os.getenv("DEEPSEEK_API_KEY", ""))
    deepseek_base_url: str = field(default_factory=lambda: os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"))
    deepseek_model: str = field(
        default_factory=lambda: os.getenv("DEEPSEEK_MODEL", os.getenv("LLM_MODEL", "deepseek-v4-flash"))
    )
    ollama_base_url: str = field(default_factory=lambda: os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"))
    ollama_model: str = field(default_factory=lambda: os.getenv("OLLAMA_MODEL", "qwen3:8b"))
    rag_top_k: int = field(default_factory=lambda: int(os.getenv("RAG_TOP_K", "5")))
    retrieval_mode: str = field(default_factory=lambda: os.getenv("RETRIEVAL_MODE", "hybrid"))
    retrieval_candidate_limit: int = field(
        default_factory=lambda: int(os.getenv("RETRIEVAL_CANDIDATE_LIMIT", "30"))
    )
    retrieval_score_threshold: float = field(
        default_factory=lambda: float(os.getenv("RETRIEVAL_SCORE_THRESHOLD", "0"))
    )
    vector_index_enabled: bool = field(default_factory=lambda: _env_bool("VECTOR_INDEX_ENABLED", "false"))
    embedding_provider: str = field(default_factory=lambda: os.getenv("EMBEDDING_PROVIDER", "ollama"))
    embedding_model: str = field(default_factory=lambda: os.getenv("EMBEDDING_MODEL", "bge-m3:567m"))
    embedding_base_url: str = field(
        default_factory=lambda: os.getenv("EMBEDDING_BASE_URL", os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"))
    )
    embedding_api_key: str = field(default_factory=lambda: os.getenv("EMBEDDING_API_KEY", ""))
    embedding_timeout_seconds: int = field(
        default_factory=lambda: int(os.getenv("EMBEDDING_TIMEOUT_SECONDS", "60"))
    )
    rerank_enabled: bool = field(default_factory=lambda: _env_bool("RERANK_ENABLED", "true"))
    # 跨平台路径：环境变量优先，兜底使用项目根目录下的 models 子目录
    rerank_model_path: str = field(
        default_factory=lambda: os.getenv(
            "RERANK_MODEL_PATH",
            str(Path(__file__).resolve().parents[3] / "models"),
        )
    )
    smtp_host: str = field(default_factory=lambda: os.getenv("SMTP_HOST", "smtp.qq.com"))
    smtp_port: int = field(default_factory=lambda: int(os.getenv("SMTP_PORT", "465")))
    smtp_username: str = field(default_factory=lambda: os.getenv("SMTP_USERNAME", ""))
    smtp_password: str = field(default_factory=lambda: os.getenv("SMTP_PASSWORD", ""))
    smtp_from_email: str = field(default_factory=lambda: os.getenv("SMTP_FROM_EMAIL", os.getenv("SMTP_USERNAME", "")))
    smtp_from_name: str = field(default_factory=lambda: os.getenv("SMTP_FROM_NAME", "企业知识平台"))
    smtp_use_ssl: bool = field(default_factory=lambda: _env_bool("SMTP_USE_SSL", "true"))
    smtp_use_tls: bool = field(default_factory=lambda: _env_bool("SMTP_USE_TLS", "false"))
    email_code_expire_minutes: int = field(default_factory=lambda: int(os.getenv("EMAIL_CODE_EXPIRE_MINUTES", "10")))
    email_code_resend_seconds: int = field(default_factory=lambda: int(os.getenv("EMAIL_CODE_RESEND_SECONDS", "60")))

    n8n_url: str = field(default_factory=lambda: os.getenv("N8N_URL", "http://localhost:5678"))
    minio_endpoint: str = field(default_factory=lambda: os.getenv("MINIO_ENDPOINT", "http://localhost:9000"))
    minio_access_key: str = field(default_factory=lambda: os.getenv("MINIO_ACCESS_KEY", ""))
    minio_secret_key: str = field(default_factory=lambda: os.getenv("MINIO_SECRET_KEY", ""))
    minio_bucket: str = field(default_factory=lambda: os.getenv("MINIO_BUCKET", "enterprise-knowledge-platform"))
    minio_secure: bool = field(default_factory=lambda: _env_bool("MINIO_SECURE", "false"))
    neo4j_enabled: bool = field(default_factory=lambda: _env_bool("NEO4J_ENABLED", "false"))
    neo4j_uri: str = field(default_factory=lambda: os.getenv("NEO4J_URI", "bolt://localhost:7687"))
    neo4j_username: str = field(default_factory=lambda: os.getenv("NEO4J_USERNAME", ""))
    neo4j_password: str = field(default_factory=lambda: os.getenv("NEO4J_PASSWORD", ""))
    neo4j_database: str = field(default_factory=lambda: os.getenv("NEO4J_DATABASE", "neo4j"))
    mysql_host: str = field(default_factory=lambda: os.getenv("MYSQL_HOST", "localhost"))
    mysql_port: int = field(default_factory=lambda: int(os.getenv("MYSQL_PORT", "3306")))
    redis_host: str = field(default_factory=lambda: os.getenv("REDIS_HOST", "localhost"))
    redis_port: int = field(default_factory=lambda: int(os.getenv("REDIS_PORT", "6379")))
    redis_password: str = field(default_factory=lambda: os.getenv("REDIS_PASSWORD", ""))
    celery_enabled: bool = field(default_factory=lambda: _env_bool("CELERY_ENABLED", "false"))
    celery_broker_url: str = field(
        default_factory=lambda: os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"))
    celery_result_backend: str = field(
        default_factory=lambda: os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1"))
    milvus_host: str = field(default_factory=lambda: os.getenv("MILVUS_HOST", "localhost"))
    milvus_grpc_port: int = field(default_factory=lambda: int(os.getenv("MILVUS_GRPC_PORT", "19530")))
    milvus_http_port: int = field(default_factory=lambda: int(os.getenv("MILVUS_HTTP_PORT", "9091")))
    milvus_alias: str = field(default_factory=lambda: os.getenv("MILVUS_ALIAS", "default"))
    milvus_collection: str = field(
        default_factory=lambda: os.getenv("MILVUS_COLLECTION", "rag_document_chunks"))
    milvus_uri: str = field(default_factory=lambda: os.getenv("MILVUS_URI", ""))
    milvus_metric_type: str = field(
        default_factory=lambda: os.getenv("MILVUS_METRIC_TYPE", "COSINE").upper())
    vector_timeout_seconds: int = field(
        default_factory=lambda: int(os.getenv("VECTOR_TIMEOUT_SECONDS", "10"))
    )
    auto_create_schema: bool = field(default_factory=lambda: _env_bool("AUTO_CREATE_SCHEMA", "true"))
    metrics_enabled: bool = field(default_factory=lambda: _env_bool("METRICS_ENABLED", "true"))
    relational_db: str = field(default_factory=lambda: os.getenv("RELATIONAL_DB", "sqlite"))
    vector_store: str = field(default_factory=lambda: os.getenv("VECTOR_STORE", "milvus"))
    graph_db: str = field(default_factory=lambda: os.getenv("GRAPH_DB", "neo4j"))
    # 审计日志自动保留天数，0 表示不自动清理
    audit_log_retention_days: int = field(
        default_factory=lambda: int(os.getenv("AUDIT_LOG_RETENTION_DAYS", "90"))
    )

    def __post_init__(self) -> None:
        """启动时校验关键配置，非 local 环境使用默认密钥则拒绝启动。"""
        if self.app_env != "local" and self.jwt_secret_key == _DEFAULT_JWT_SECRET:
            print(
                "[FATAL] JWT_SECRET_KEY 使用了默认开发密钥，"
                "非 local 环境禁止启动。请在 .env 中设置强随机密钥。",
                file=sys.stderr,
            )
            sys.exit(1)
        if self.jwt_secret_key == _DEFAULT_JWT_SECRET:
            print(
                "[WARNING] JWT_SECRET_KEY 使用了默认开发密钥，"
                "仅允许在 local 环境使用，生产部署前请务必修改。",
                file=sys.stderr,
            )


def get_settings() -> Settings:
    return Settings()
