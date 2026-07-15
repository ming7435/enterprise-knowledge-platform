from __future__ import annotations


def list_agent_tools() -> list[dict]:
    """返回可供 Agent/MCP 适配层注册的工作区安全工具。"""
    return [
        {
            "name": "search_knowledge",
            "description": "在当前工作区和指定知识库范围内执行混合检索。",
            "read_only": True,
            "input_schema": {
                "type": "object",
                "required": ["query"],
                "properties": {
                    "query": {"type": "string", "maxLength": 2000},
                    "document_ids": {"type": "array", "items": {"type": "string"}},
                    "top_k": {"type": "integer", "minimum": 1, "maximum": 20},
                },
            },
        },
        {
            "name": "get_document_content",
            "description": "读取当前工作区中的单个文档内容。",
            "read_only": True,
            "input_schema": {
                "type": "object",
                "required": ["document_id"],
                "properties": {"document_id": {"type": "string"}},
            },
        },
    ]
