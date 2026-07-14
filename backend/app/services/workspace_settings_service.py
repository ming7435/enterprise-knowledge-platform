from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.entities import VectorIndex, Workspace, WorkspaceSetting

MODEL_CATALOG: dict[str, dict[str, object]] = {
    "chatgpt": {
        "label": "ChatGPT",
        "models": ["gpt-5", "gpt-4o", "gpt-4.1", "o4-mini"],
        "base_url": "https://api.openai.com/v1",
    },
    "opus": {
        "label": "Opus",
        "models": ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-6"],
        "base_url": "https://api.anthropic.com/v1",
    },
    "glm": {
        "label": "GLM",
        "models": ["glm-5.2", "glm-5", "glm-4.7-flash", "glm-4.6"],
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
    },
    "deepseek": {
        "label": "DeepSeek",
        "models": ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-r1", "deepseek-v3"],
        "base_url": "https://api.deepseek.com",
    },
    "qianwen": {
        "label": "千问",
        "models": ["qwen3-235b-a22b", "qwen-max", "qwen-plus", "qwen-turbo", "qwq-32b"],
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    },
    "doubao": {
        "label": "豆包",
        "models": ["doubao-pro-4k", "doubao-pro-32k", "doubao-lite"],
        "base_url": "https://ark.cn-beijing.volces.com/api/v3",
    },
    "gemini": {
        "label": "Gemini",
        "models": ["gemini-3.1-pro", "gemini-flash"],
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
    },
    "kimi": {
        "label": "Kimi",
        "models": ["moonshot-v1-128k", "kimi-k2.5"],
        "base_url": "https://api.moonshot.cn/v1",
    },
    "minimax": {
        "label": "MiniMax",
        "models": ["minimax-m2.5"],
        "base_url": "https://api.minimax.chat/v1",
    },
    "ernie": {
        "label": "文心一言",
        "models": ["ernie-4.0"],
        "base_url": "https://qianfan.baidubce.com/v2",
    },
    "grok": {
        "label": "Grok",
        "models": ["grok-2"],
        "base_url": "https://api.x.ai/v1",
    },
}

PERSONAL_MODEL_KEY = "personal_model_config"
PERSONAL_VECTOR_KEY = "personal_vector_config"
ENTERPRISE_MODEL_API_KEY = "enterprise_model_api_config"


@dataclass(frozen=True)
class WorkspaceRagRuntime:
    top_k: int
    score_threshold: float
    model_config: dict | None


def list_workspace_settings(db: Session, *, workspace: Workspace) -> list[dict]:
    stored = {
        setting.setting_key: setting
        for setting in db.execute(
            select(WorkspaceSetting).where(WorkspaceSetting.workspace_id == workspace.id)
        ).scalars().all()
    }
    keys = _allowed_setting_keys(workspace)
    return [_setting_to_public(stored.get(key), key=key, workspace=workspace) for key in keys]


def upsert_workspace_setting(
    db: Session,
    *,
    workspace: Workspace,
    setting_key: str,
    setting_value: dict,
    setting_type: str = "json",
) -> dict:
    if setting_key not in _allowed_setting_keys(workspace):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该配置项不适用于当前工作区类型",
        )
    existing = db.execute(
        select(WorkspaceSetting).where(
            WorkspaceSetting.workspace_id == workspace.id,
            WorkspaceSetting.setting_key == setting_key,
        )
    ).scalar_one_or_none()
    existing_value = existing.setting_value if existing else {}
    normalized_value = _normalize_setting_value(
        workspace=workspace,
        setting_key=setting_key,
        value=setting_value,
        existing_value=existing_value,
    )
    encrypted = setting_key in {PERSONAL_MODEL_KEY, ENTERPRISE_MODEL_API_KEY}
    if existing is None:
        existing = WorkspaceSetting(
            workspace_id=workspace.id,
            setting_key=setting_key,
            setting_value=normalized_value,
            setting_type=setting_type,
            encrypted=encrypted,
        )
        db.add(existing)
    else:
        existing.setting_value = normalized_value
        existing.setting_type = setting_type
        existing.encrypted = encrypted
    if setting_key == PERSONAL_VECTOR_KEY:
        _sync_personal_vector_index(db, workspace=workspace, value=normalized_value)
    db.flush()
    return _setting_to_public(existing, key=setting_key, workspace=workspace)


def test_workspace_model_api_connection(
    db: Session,
    *,
    workspace: Workspace,
    setting_key: str,
    setting_value: dict,
    settings: Settings,
) -> dict:
    if setting_key not in _allowed_setting_keys(workspace):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该配置项不适用于当前工作区类型",
        )
    if setting_key not in {PERSONAL_MODEL_KEY, ENTERPRISE_MODEL_API_KEY}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该配置项不是模型 API 配置",
        )

    existing = db.execute(
        select(WorkspaceSetting).where(
            WorkspaceSetting.workspace_id == workspace.id,
            WorkspaceSetting.setting_key == setting_key,
        )
    ).scalar_one_or_none()
    existing_value = existing.setting_value if existing else {}
    normalized_value = _normalize_setting_value(
        workspace=workspace,
        setting_key=setting_key,
        value=setting_value,
        existing_value=existing_value,
    )
    resolved_config = (
        _resolve_personal_model_api_config(normalized_value, settings)
        if setting_key == PERSONAL_MODEL_KEY
        else _resolve_enterprise_model_api_config(normalized_value)
    )
    if not resolved_config or not resolved_config.get("api_key"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先配置模型 API Key 后再测试连接",
        )

    from app.services.rag_chat_service import WorkspaceApiRagClient

    provider = str(resolved_config.get("provider") or "deepseek").lower()
    model_name = str(resolved_config.get("model_name") or "deepseek-v4-flash")
    max_tokens = _int_value(
        resolved_config.get("max_tokens"),
        default=512,
        min_value=256,
        max_value=8192,
    )
    try:
        result = WorkspaceApiRagClient(
            {
                **resolved_config,
                "max_tokens": min(max_tokens, 512),
            }
        ).generate(
            question="请只回复 OK，用于测试企业知识平台模型 API 连接。",
            sources=[],
            use_knowledge_base=False,
        )
        return {
            "ok": True,
            "provider": provider,
            "model_name": result.model_name,
            "message": "模型 API 连接成功",
            "response_preview": result.answer[:120],
        }
    except Exception as exc:
        return {
            "ok": False,
            "provider": provider,
            "model_name": model_name,
            "message": f"模型 API 连接失败：{exc}",
            "response_preview": None,
        }


def get_workspace_rag_runtime(
    db: Session, *, workspace_id: str, settings: Settings
) -> WorkspaceRagRuntime:
    workspace = db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    ).scalar_one_or_none()
    if workspace is None:
        return WorkspaceRagRuntime(
            top_k=settings.rag_top_k,
            score_threshold=0.0,
            model_config=None,
        )
    if workspace.type == "personal":
        vector_config = _get_setting_value(
            db,
            workspace_id=workspace_id,
            setting_key=PERSONAL_VECTOR_KEY,
            default=_personal_vector_default(),
        )
        model_config = _get_setting_value(
            db,
            workspace_id=workspace_id,
            setting_key=PERSONAL_MODEL_KEY,
            default=_personal_model_default(),
        )
        return WorkspaceRagRuntime(
            top_k=_int_value(vector_config.get("top_k"), default=settings.rag_top_k, min_value=1, max_value=20),
            score_threshold=_float_value(
                vector_config.get("score_threshold"), default=0.35, min_value=0.0, max_value=1.0
            ),
            model_config=_resolve_personal_model_api_config(model_config, settings),
        )
    model_config = _get_setting_value(
        db,
        workspace_id=workspace_id,
        setting_key=ENTERPRISE_MODEL_API_KEY,
        default=_enterprise_model_api_default(),
    )
    return WorkspaceRagRuntime(
        top_k=settings.rag_top_k,
        score_threshold=0.0,
        model_config=_resolve_enterprise_model_api_config(model_config),
    )


def _get_setting_value(
    db: Session, *, workspace_id: str, setting_key: str, default: dict
) -> dict:
    setting = db.execute(
        select(WorkspaceSetting).where(
            WorkspaceSetting.workspace_id == workspace_id,
            WorkspaceSetting.setting_key == setting_key,
        )
    ).scalar_one_or_none()
    if setting is None:
        return dict(default)
    return {**default, **(setting.setting_value or {})}


def _allowed_setting_keys(workspace: Workspace) -> list[str]:
    if workspace.type == "enterprise":
        return [ENTERPRISE_MODEL_API_KEY]
    return [PERSONAL_MODEL_KEY, PERSONAL_VECTOR_KEY]


def _setting_to_public(
    setting: WorkspaceSetting | None, *, key: str, workspace: Workspace
) -> dict:
    default = _default_value_for(workspace, key)
    value = {**default, **(setting.setting_value if setting else {})}
    return {
        "setting_key": key,
        "setting_value": _sanitize_setting_value(key, value),
        "setting_type": setting.setting_type if setting else "json",
        "encrypted": "true"
        if (setting.encrypted if setting else key in {PERSONAL_MODEL_KEY, ENTERPRISE_MODEL_API_KEY})
        else "false",
    }


def _default_value_for(workspace: Workspace, key: str) -> dict:
    if key == PERSONAL_MODEL_KEY:
        return _personal_model_default()
    if key == PERSONAL_VECTOR_KEY:
        return _personal_vector_default()
    if key == ENTERPRISE_MODEL_API_KEY:
        return _enterprise_model_api_default()
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="未知配置项",
    )


def _normalize_setting_value(
    *, workspace: Workspace, setting_key: str, value: dict, existing_value: dict
) -> dict:
    if setting_key == PERSONAL_MODEL_KEY:
        return _normalize_model_config(
            value,
            default=_personal_model_default(),
            include_api_key=True,
            existing_value=existing_value,
        )
    if setting_key == PERSONAL_VECTOR_KEY:
        return _normalize_personal_vector_config(value)
    if setting_key == ENTERPRISE_MODEL_API_KEY:
        return _normalize_model_config(
            value,
            default=_enterprise_model_api_default(),
            include_api_key=True,
            existing_value=existing_value,
        )
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="未知配置项",
    )


def _normalize_model_config(
    value: dict,
    *,
    default: dict,
    include_api_key: bool,
    existing_value: dict | None = None,
) -> dict:
    provider = str(value.get("provider") or default["provider"]).strip().lower()
    if provider not in MODEL_CATALOG:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不支持的模型供应商",
        )
    catalog_item = MODEL_CATALOG[provider]
    default_model = list(catalog_item["models"])[0]
    model_name = str(value.get("model_name") or default.get("model_name") or default_model).strip()
    if not model_name or model_name not in catalog_item["models"]:
        model_name = default_model
    normalized = {
        "provider": provider,
        "provider_label": str(catalog_item["label"]),
        "model_name": model_name,
        "model_options": list(catalog_item["models"]),
        "base_url": str(value.get("base_url") or catalog_item["base_url"]).strip().rstrip("/"),
        "temperature": _float_value(value.get("temperature"), default=default.get("temperature", 0.2), min_value=0.0, max_value=2.0),
        "max_tokens": _int_value(value.get("max_tokens"), default=default.get("max_tokens", 2048), min_value=256, max_value=8192),
        "enable_rag": _bool_value(value.get("enable_rag"), default=default.get("enable_rag", True)),
        "return_sources": _bool_value(value.get("return_sources"), default=default.get("return_sources", True)),
    }
    if include_api_key:
        next_api_key = str(value.get("api_key") or "").strip()
        if next_api_key:
            normalized["api_key"] = next_api_key
        elif existing_value and existing_value.get("api_key"):
            normalized["api_key"] = existing_value["api_key"]
    return normalized


def _normalize_personal_vector_config(value: dict) -> dict:
    chunk_size = _int_value(value.get("chunk_size"), default=800, min_value=200, max_value=3000)
    chunk_overlap = _int_value(
        value.get("chunk_overlap"), default=120, min_value=0, max_value=max(0, chunk_size - 1)
    )
    retrieval_mode = str(value.get("retrieval_mode") or "hybrid").strip().lower()
    if retrieval_mode not in {"vector", "hybrid", "keyword"}:
        retrieval_mode = "hybrid"
    return {
        "vector_type": "milvus",
        "embedding_model": str(value.get("embedding_model") or "bge-m3:567m"),
        "top_k": _int_value(value.get("top_k"), default=5, min_value=1, max_value=20),
        "score_threshold": _float_value(value.get("score_threshold"), default=0.35, min_value=0.0, max_value=1.0),
        "retrieval_mode": retrieval_mode,
        "rerank_enabled": _bool_value(value.get("rerank_enabled"), default=True),
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
    }


def _sync_personal_vector_index(db: Session, *, workspace: Workspace, value: dict) -> None:
    vector_index = db.execute(
        select(VectorIndex).where(VectorIndex.workspace_id == workspace.id)
    ).scalar_one_or_none()
    if vector_index is None:
        vector_index = VectorIndex(workspace_id=workspace.id)
        db.add(vector_index)
    vector_index.vector_type = "milvus"
    vector_index.embedding_model = str(value.get("embedding_model") or "bge-m3:567m")
    vector_index.top_k = _int_value(value.get("top_k"), default=5, min_value=1, max_value=20)
    vector_index.score_threshold = str(_float_value(value.get("score_threshold"), default=0.35, min_value=0.0, max_value=1.0))
    vector_index.chunk_size = _int_value(value.get("chunk_size"), default=800, min_value=200, max_value=3000)
    vector_index.chunk_overlap = _int_value(
        value.get("chunk_overlap"), default=120, min_value=0, max_value=max(0, vector_index.chunk_size - 1)
    )
    vector_index.rerank_enabled = "true" if _bool_value(value.get("rerank_enabled"), default=True) else "false"


def _sanitize_setting_value(key: str, value: dict) -> dict:
    if key not in {PERSONAL_MODEL_KEY, ENTERPRISE_MODEL_API_KEY}:
        return value
    sanitized = {key_name: key_value for key_name, key_value in value.items() if key_name != "api_key"}
    api_key = str(value.get("api_key") or "")
    sanitized["api_key_configured"] = bool(api_key)
    sanitized["api_key_masked"] = _mask_secret(api_key) if api_key else None
    return sanitized


def _resolve_personal_model_api_config(config: dict, settings: Settings) -> dict | None:
    if config.get("api_key"):
        return config
    if settings.llm_provider.lower() == "local":
        return None
    provider = str(config.get("provider") or "deepseek").lower()
    if provider == "deepseek" and settings.deepseek_api_key:
        return {
            **config,
            "api_key": settings.deepseek_api_key,
            "base_url": settings.deepseek_base_url.rstrip("/"),
        }
    return None


def _resolve_enterprise_model_api_config(config: dict) -> dict | None:
    if not config.get("api_key"):
        return None
    return config


def _personal_model_default() -> dict:
    return {
        "provider": "deepseek",
        "provider_label": "DeepSeek",
        "model_name": "deepseek-v4-flash",
        "model_options": MODEL_CATALOG["deepseek"]["models"],
        "base_url": MODEL_CATALOG["deepseek"]["base_url"],
        "temperature": 0.2,
        "max_tokens": 2048,
        "enable_rag": True,
        "return_sources": True,
    }


def _personal_vector_default() -> dict:
    return {
        "vector_type": "milvus",
        "embedding_model": "bge-m3:567m",
        "top_k": 5,
        "score_threshold": 0.35,
        "retrieval_mode": "hybrid",
        "rerank_enabled": True,
        "chunk_size": 800,
        "chunk_overlap": 120,
    }


def _enterprise_model_api_default() -> dict:
    return {
        "provider": "deepseek",
        "provider_label": "DeepSeek",
        "model_name": "deepseek-v4-flash",
        "model_options": MODEL_CATALOG["deepseek"]["models"],
        "base_url": MODEL_CATALOG["deepseek"]["base_url"],
        "temperature": 0.2,
        "max_tokens": 4096,
        "enable_rag": True,
        "return_sources": True,
    }


def _float_value(value: object, *, default: float, min_value: float, max_value: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = float(default)
    return round(min(max(number, min_value), max_value), 4)


def _int_value(value: object, *, default: int, min_value: int, max_value: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = int(default)
    return min(max(number, min_value), max_value)


def _bool_value(value: object, *, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on", "开启"}
    return bool(default)


def _mask_secret(secret: str) -> str:
    if len(secret) <= 8:
        return f"{secret[:2]}***"
    return f"{secret[:4]}***{secret[-4:]}"
