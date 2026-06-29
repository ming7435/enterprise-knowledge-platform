from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import re
import zipfile
import xml.etree.ElementTree as ET

from app.services.storage_service import file_extension


class DocumentProcessingError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedDocument:
    text: str
    parser: str


def extract_document_text(
    *,
    filename: str,
    content_type: str | None,
    content: bytes,
) -> ParsedDocument:
    extension = file_extension(filename, content_type)
    if extension in {"txt", "md", "csv", "json", "log"}:
        return ParsedDocument(text=_decode_text(content), parser="plain-text")
    if extension == "docx":
        return ParsedDocument(text=_extract_docx_text(content), parser="docx")
    if extension == "pdf":
        return ParsedDocument(text=_extract_pdf_text(content), parser="pdf")

    text = _decode_text(content)
    if _looks_like_text(text):
        return ParsedDocument(text=text, parser="best-effort-text")
    raise DocumentProcessingError(f"暂不支持解析 {extension} 类型文档")


def split_text_into_chunks(
    text: str,
    *,
    chunk_size: int = 800,
    chunk_overlap: int = 120,
) -> list[str]:
    normalized = _normalize_text(text)
    if not normalized:
        return []

    size = max(200, chunk_size)
    overlap = max(0, min(chunk_overlap, size // 3))
    chunks: list[str] = []
    cursor = 0
    while cursor < len(normalized):
        end = min(cursor + size, len(normalized))
        if end < len(normalized):
            break_at = _find_breakpoint(normalized, cursor, end)
            if break_at > cursor:
                end = break_at

        chunk = normalized[cursor:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(normalized):
            break
        cursor = max(end - overlap, cursor + 1)
    return chunks


def _decode_text(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "utf-16", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise DocumentProcessingError("无法识别文档编码")


def _extract_docx_text(content: bytes) -> str:
    try:
        with zipfile.ZipFile(BytesIO(content)) as archive:
            xml_content = archive.read("word/document.xml")
    except (KeyError, zipfile.BadZipFile) as exc:
        raise DocumentProcessingError("DOCX 文档结构异常，无法解析") from exc

    root = ET.fromstring(xml_content)
    paragraphs: list[str] = []
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    for paragraph in root.iter(f"{namespace}p"):
        parts = [
            node.text or ""
            for node in paragraph.iter(f"{namespace}t")
            if node.text
        ]
        if parts:
            paragraphs.append("".join(parts))
    return "\n".join(paragraphs)


def _extract_pdf_text(content: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise DocumentProcessingError("PDF 解析组件未安装，请先安装 backend/requirements.txt") from exc

    reader = PdfReader(BytesIO(content))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(page.strip() for page in pages if page.strip())


def _normalize_text(text: str) -> str:
    without_nulls = text.replace("\x00", "")
    compact_spaces = re.sub(r"[ \t\r\f\v]+", " ", without_nulls)
    compact_lines = re.sub(r"\n{3,}", "\n\n", compact_spaces)
    return compact_lines.strip()


def _looks_like_text(text: str) -> bool:
    if not text.strip():
        return False
    control_chars = sum(1 for char in text if ord(char) < 32 and char not in "\n\r\t")
    return control_chars / max(len(text), 1) < 0.02


def _find_breakpoint(text: str, start: int, end: int) -> int:
    search_start = start + max((end - start) // 2, 1)
    candidates = [
        text.rfind(separator, search_start, end)
        for separator in ("\n\n", "\n", "。", "；", ";", "，", ",", ".")
    ]
    return max(candidates)
