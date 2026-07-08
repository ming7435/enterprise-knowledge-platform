from __future__ import annotations

from dataclasses import dataclass
import json
from urllib.error import URLError
from urllib.request import Request, urlopen

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.entities import ChatMessage, ChatSession, User
from app.services.document_service import ChunkSearchResult, search_workspace_chunks
from app.services.workspace_service import write_audit_log
from app.services.workspace_settings_service import get_workspace_rag_runtime


@dataclass(frozen=True)
class RagGeneration:
    answer: str
    model_name: str
    agent_trace: list[dict]


class RagLlmClient:
    def generate(
        self,
        *,
        question: str,
        sources: list[ChunkSearchResult],
        use_knowledge_base: bool = True,
    ) -> RagGeneration:
        raise NotImplementedError


class LocalRagClient(RagLlmClient):
    def generate(
        self,
        *,
        question: str,
        sources: list[ChunkSearchResult],
        use_knowledge_base: bool = True,
    ) -> RagGeneration:
        if use_knowledge_base and not sources:
            return RagGeneration(
                answer="当前工作区没有检索到可用于回答的知识片段，请先上传并解析相关文档。",
                model_name="model-unavailable",
                agent_trace=[{"provider": "local", "status": "no_context"}],
            )
        if not use_knowledge_base:
            return RagGeneration(
                answer=(
                    "当前没有连接到可用的大模型，因此暂时不能进行普通对话。"
                    "请配置工作区模型 API Key、DEEPSEEK_API_KEY，或启动并配置 Ollama 模型后重试。"
                ),
                model_name="model-unavailable",
                agent_trace=[{"provider": "local", "status": "normal_chat_unavailable"}],
            )
        answer = (
            "当前没有连接到可用的大模型，因此暂时不能生成综合回答。"
            "请在本地 .env 配置 DEEPSEEK_API_KEY，或启动并配置 Ollama 模型后重试。"
            "系统已经检索到相关来源片段，你可以在下方“来源”中核对依据；模型连通后会基于这些来源生成正常的自然语言答案。"
        )
        return RagGeneration(
            answer=answer,
            model_name="model-unavailable",
            agent_trace=[{"provider": "local", "status": "model_unavailable"}],
        )


class DeepSeekRagClient(RagLlmClient):
    def __init__(self, settings: Settings):
        self.settings = settings

    def generate(
        self,
        *,
        question: str,
        sources: list[ChunkSearchResult],
        use_knowledge_base: bool = True,
    ) -> RagGeneration:
        if not self.settings.deepseek_api_key:
            raise RuntimeError("DeepSeek API Key 未配置")
        payload = {
            "model": self.settings.deepseek_model,
            "messages": [
                {"role": "system", "content": _system_prompt(use_knowledge_base=use_knowledge_base)},
                {
                    "role": "user",
                    "content": _user_prompt(
                        question,
                        sources,
                        use_knowledge_base=use_knowledge_base,
                    ),
                },
            ],
            "temperature": 0.2,
        }
        response = _post_json(
            f"{self.settings.deepseek_base_url.rstrip('/')}/chat/completions",
            payload,
            headers={"Authorization": f"Bearer {self.settings.deepseek_api_key}"},
        )
        content = response["choices"][0]["message"]["content"]
        return RagGeneration(
            answer=content.strip(),
            model_name=self.settings.deepseek_model,
            agent_trace=[{"provider": "deepseek", "status": "answered"}],
        )


class OllamaRagClient(RagLlmClient):
    def __init__(self, settings: Settings):
        self.settings = settings

    def generate(
        self,
        *,
        question: str,
        sources: list[ChunkSearchResult],
        use_knowledge_base: bool = True,
    ) -> RagGeneration:
        payload = {
            "model": self.settings.ollama_model,
            "stream": False,
            "messages": [
                {"role": "system", "content": _system_prompt(use_knowledge_base=use_knowledge_base)},
                {
                    "role": "user",
                    "content": _user_prompt(
                        question,
                        sources,
                        use_knowledge_base=use_knowledge_base,
                    ),
                },
            ],
        }
        response = _post_json(
            f"{self.settings.ollama_base_url.rstrip('/')}/api/chat",
            payload,
            headers={},
        )
        content = response["message"]["content"]
        return RagGeneration(
            answer=content.strip(),
            model_name=self.settings.ollama_model,
            agent_trace=[{"provider": "ollama", "status": "answered"}],
        )


class WorkspaceApiRagClient(RagLlmClient):
    def __init__(self, model_config: dict):
        self.model_config = model_config

    def generate(
        self,
        *,
        question: str,
        sources: list[ChunkSearchResult],
        use_knowledge_base: bool = True,
    ) -> RagGeneration:
        api_key = str(self.model_config.get("api_key") or "").strip()
        if not api_key:
            raise RuntimeError("工作区模型 API Key 未配置")
        provider = str(self.model_config.get("provider") or "deepseek").lower()
        model_name = str(self.model_config.get("model_name") or "deepseek-v4-flash")
        base_url = str(self.model_config.get("base_url") or "").rstrip("/")
        temperature = float(self.model_config.get("temperature") or 0.2)
        max_tokens = int(self.model_config.get("max_tokens") or 2048)
        if provider == "opus":
            response = _post_json(
                f"{base_url}/messages",
                {
                    "model": model_name,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": _system_prompt(use_knowledge_base=use_knowledge_base),
                    "messages": [
                        {
                            "role": "user",
                            "content": _user_prompt(
                                question,
                                sources,
                                use_knowledge_base=use_knowledge_base,
                            ),
                        }
                    ],
                },
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
            )
            content = "".join(
                block.get("text", "")
                for block in response.get("content", [])
                if isinstance(block, dict)
            )
        else:
            response = _post_json(
                f"{base_url}/chat/completions",
                {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": _system_prompt(use_knowledge_base=use_knowledge_base)},
                        {
                            "role": "user",
                            "content": _user_prompt(
                                question,
                                sources,
                                use_knowledge_base=use_knowledge_base,
                            ),
                        },
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                headers={"Authorization": f"Bearer {api_key}"},
            )
            content = response["choices"][0]["message"]["content"]
        return RagGeneration(
            answer=content.strip(),
            model_name=model_name,
            agent_trace=[{"provider": provider, "status": "answered"}],
        )


class FallbackRagClient(RagLlmClient):
    def __init__(self, settings: Settings, workspace_model_config: dict | None = None):
        self.settings = settings
        self.workspace_model_config = workspace_model_config
        self.local_client = LocalRagClient()

    def generate(
        self,
        *,
        question: str,
        sources: list[ChunkSearchResult],
        use_knowledge_base: bool = True,
    ) -> RagGeneration:
        traces: list[dict] = []
        provider = self.settings.llm_provider.lower()
        candidates: list[RagLlmClient] = []
        if self.workspace_model_config is not None:
            candidates.append(WorkspaceApiRagClient(self.workspace_model_config))
        if provider == "deepseek":
            candidates.extend([DeepSeekRagClient(self.settings), OllamaRagClient(self.settings)])
        elif provider == "ollama":
            candidates.append(OllamaRagClient(self.settings))
        elif provider == "local":
            candidates.append(self.local_client)
        else:
            candidates.extend([DeepSeekRagClient(self.settings), OllamaRagClient(self.settings)])

        for client in candidates:
            try:
                result = client.generate(
                    question=question,
                    sources=sources,
                    use_knowledge_base=use_knowledge_base,
                )
                return RagGeneration(
                    answer=result.answer,
                    model_name=result.model_name,
                    agent_trace=[*traces, *result.agent_trace],
                )
            except Exception as exc:
                traces.append(
                    {
                        "provider": client.__class__.__name__,
                        "status": "failed",
                        "reason": str(exc),
                    }
                )

        result = self.local_client.generate(
            question=question,
            sources=sources,
            use_knowledge_base=use_knowledge_base,
        )
        return RagGeneration(
            answer=result.answer,
            model_name=result.model_name,
            agent_trace=[*traces, *result.agent_trace],
        )


def ask_workspace_question(
    db: Session,
    *,
    settings: Settings,
    user: User,
    workspace_id: str,
    question: str,
    session_id: str | None = None,
    top_k: int | None = None,
    document_ids: list[str] | None = None,
    use_knowledge_base: bool = False,
    llm_client: RagLlmClient | None = None,
) -> dict:
    clean_question = question.strip()
    runtime = get_workspace_rag_runtime(db, workspace_id=workspace_id, settings=settings)
    sources: list[ChunkSearchResult] = []
    if use_knowledge_base:
        safe_top_k = min(max(top_k or runtime.top_k or settings.rag_top_k, 1), 20)
        sources = search_workspace_chunks(
            db,
            workspace_id=workspace_id,
            query=clean_question,
            limit=safe_top_k,
            document_ids=document_ids,
        )
        if runtime.score_threshold > 0:
            sources = [source for source in sources if source.score >= runtime.score_threshold]
    session = _get_or_create_session(
        db,
        user=user,
        workspace_id=workspace_id,
        session_id=session_id,
        question=clean_question,
        mode="rag" if use_knowledge_base else "normal",
    )
    db.add(
        ChatMessage(
            workspace_id=workspace_id,
            session_id=session.id,
            user_id=user.id,
            role="user",
            content=clean_question,
            sources=[],
            agent_trace=[],
        )
    )

    generator = llm_client or FallbackRagClient(
        settings,
        workspace_model_config=runtime.model_config,
    )
    generation = generator.generate(
        question=clean_question,
        sources=sources,
        use_knowledge_base=use_knowledge_base,
    )
    source_payload = [_source_to_payload(source) for source in sources]
    assistant_message = ChatMessage(
        workspace_id=workspace_id,
        session_id=session.id,
        user_id=user.id,
        role="assistant",
        content=generation.answer,
        sources=source_payload,
        agent_trace=generation.agent_trace,
        model_name=generation.model_name,
    )
    db.add(assistant_message)
    db.flush()
    _sync_question_to_graph(
        db,
        settings=settings,
        workspace_id=workspace_id,
        user=user,
        assistant_message=assistant_message,
        question=clean_question,
        generation=generation,
        source_payload=source_payload,
    )
    write_audit_log(
        db,
        action="chat.asked",
        user_id=user.id,
        workspace_id=workspace_id,
        target_type="chat_session",
        target_id=session.id,
        detail={
            "source_count": len(source_payload),
            "model": generation.model_name,
            "document_ids": document_ids or [],
            "use_knowledge_base": use_knowledge_base,
        },
    )
    db.flush()
    return {
        "session": session,
        "answer": generation.answer,
        "sources": source_payload,
        "model_name": generation.model_name,
        "use_knowledge_base": use_knowledge_base,
    }


def _get_or_create_session(
    db: Session,
    *,
    user: User,
    workspace_id: str,
    session_id: str | None,
    question: str,
    mode: str,
) -> ChatSession:
    if session_id:
        session = db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.workspace_id == workspace_id,
                ChatSession.user_id == user.id,
            )
        ).scalar_one_or_none()
        if session is not None:
            return session

    title = question[:30] or "新会话"
    session = ChatSession(
        workspace_id=workspace_id,
        user_id=user.id,
        title=title,
        mode=mode,
    )
    db.add(session)
    db.flush()
    return session


def _source_to_payload(source: ChunkSearchResult) -> dict:
    return {
        "id": source.id,
        "document_id": source.document_id,
        "filename": source.filename,
        "chunk_index": source.chunk_index,
        "content": source.content,
        "score": source.score,
    }


def _system_prompt(*, use_knowledge_base: bool = True) -> str:
    if not use_knowledge_base:
        return (
            "你是企业知识平台的大模型助手。请直接与用户进行正常中文对话，"
            "回答要清晰、自然、结构化。当前请求没有启用知识库检索，"
            "不要声称引用了平台知识库或文档来源。"
        )
    return (
        "你是企业知识平台的 RAG 助手。请先理解用户问题，再综合提供的知识片段生成正常的中文自然语言回答。"
        "不要把知识片段原文直接拼贴成答案，不要把来源列表当作正文。"
        "回答要结构清晰、可执行，并尽量给出结论、要点和下一步建议。"
        "如果依据不足，请明确说明缺少哪些信息。"
    )


def _user_prompt(
    question: str,
    sources: list[ChunkSearchResult],
    *,
    use_knowledge_base: bool = True,
) -> str:
    if not use_knowledge_base:
        return question
    context = "\n\n".join(
        f"[来源 {index + 1}] 文件：{source.filename}，片段：{source.chunk_index + 1}\n"
        f"{source.content}"
        for index, source in enumerate(sources)
    )
    return (
        f"问题：{question}\n\n"
        f"知识片段：\n{context or '当前没有命中的知识片段。'}\n\n"
        "请基于上述知识片段综合作答，输出给用户可直接阅读的答案。"
        "不要逐字复述片段，不要只列出片段内容。"
    )


def _post_json(url: str, payload: dict, *, headers: dict[str, str]) -> dict:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except URLError as exc:
        raise RuntimeError(str(exc)) from exc


def _sync_question_to_graph(
    db: Session,
    *,
    settings: Settings,
    workspace_id: str,
    user: User,
    assistant_message: ChatMessage,
    question: str,
    generation: RagGeneration,
    source_payload: list[dict],
) -> None:
    if not settings.neo4j_enabled or not source_payload:
        return
    try:
        from app.services import neo4j_graph_service

        result = neo4j_graph_service.syncQuestionToNeo4j(
            db,
            settings=settings,
            workspace_id=workspace_id,
            question_id=assistant_message.id,
            question_text=question,
            asker_id=user.id,
            model_name=generation.model_name,
            answer_preview=generation.answer,
            sources=source_payload,
        )
        if result.get("status") in {"unavailable", "failed"}:
            write_audit_log(
                db,
                action="graph.question_sync_failed",
                user_id=user.id,
                workspace_id=workspace_id,
                target_type="chat_message",
                target_id=assistant_message.id,
                detail={"reason": result.get("message")},
            )
    except Exception as exc:
        write_audit_log(
            db,
            action="graph.question_sync_failed",
            user_id=user.id,
            workspace_id=workspace_id,
            target_type="chat_message",
            target_id=assistant_message.id,
            detail={"reason": str(exc)},
        )
