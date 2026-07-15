from __future__ import annotations

from dataclasses import dataclass
import hashlib
from io import BytesIO
import re
import zipfile
import xml.etree.ElementTree as ET

from app.services.storage_service import file_extension


class DocumentProcessingError(ValueError):
    pass


class UnsupportedAssetError(DocumentProcessingError):
    pass


@dataclass(frozen=True)
class ParsedDocument:
    text: str
    parser: str
    sections: tuple["ParsedSection", ...] = ()


@dataclass(frozen=True)
class ParsedSection:
    text: str
    page_number: int | None = None
    section: str | None = None
    source_position: str | None = None


@dataclass(frozen=True)
class ParsedChunk:
    content: str
    page_number: int | None
    section: str | None
    source_position: str | None
    token_count: int
    content_hash: str


def extract_document_text(
    *,
    filename: str,
    content_type: str | None,
    content: bytes,
) -> ParsedDocument:
    extension = file_extension(filename, content_type)
    if extension in {"txt", "md", "csv", "json", "log"}:
        text = _decode_text(content)
        return ParsedDocument(
            text=text,
            parser="plain-text",
            sections=(ParsedSection(text=text, source_position="document"),),
        )
    if extension == "docx":
        text = _extract_docx_text(content)
        return ParsedDocument(text=text, parser="docx", sections=_sections_from_lines(text))
    if extension == "pdf":
        pages = _extract_pdf_pages(content)
        return ParsedDocument(
            text="\n\n".join(page for page in pages if page),
            parser="pdf",
            sections=tuple(
                ParsedSection(
                    text=page,
                    page_number=index,
                    section=_detect_heading(page),
                    source_position=f"page:{index}",
                )
                for index, page in enumerate(pages, start=1)
                if page
            ),
        )
    if extension == "xlsx":
        text = _extract_xlsx_text(content)
        return ParsedDocument(text=text, parser="xlsx", sections=_sections_from_lines(text, "worksheet"))
    if extension == "pptx":
        text = _extract_pptx_text(content)
        return ParsedDocument(text=text, parser="pptx", sections=_sections_from_lines(text, "slide"))
    if reason := unsupported_asset_reason(extension):
        raise UnsupportedAssetError(reason)

    text = _decode_text(content)
    if _looks_like_text(text):
        return ParsedDocument(
            text=text,
            parser="best-effort-text",
            sections=(ParsedSection(text=text, source_position="document"),),
        )
    raise UnsupportedAssetError(
        f"暂不支持解析 {extension or '未知'} 类型文件，仅作为文件资产保存。"
    )


def unsupported_asset_reason(extension: str) -> str | None:
    image_extensions = {"jpg", "jpeg", "png"}
    audio_extensions = {"mp3"}
    video_extensions = {"mp4"}
    archive_extensions = {"zip"}
    if extension in image_extensions:
        return "当前暂不支持图片文字识别，仅作为文件资产保存。"
    if extension in audio_extensions:
        return "当前暂不支持音频转文字，仅作为文件资产保存。"
    if extension in video_extensions:
        return "当前暂不支持视频内容解析，仅作为文件资产保存。"
    if extension in archive_extensions:
        return "当前暂不支持压缩包自动解析，仅作为文件资产保存。"
    return None


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


def split_parsed_document_into_chunks(
    parsed: ParsedDocument,
    *,
    chunk_size: int = 800,
    chunk_overlap: int = 120,
) -> list[ParsedChunk]:
    sections = parsed.sections or (ParsedSection(text=parsed.text, source_position="document"),)
    chunks: list[ParsedChunk] = []
    for section in sections:
        for content in split_text_into_chunks(
            section.text,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        ):
            chunks.append(
                ParsedChunk(
                    content=content,
                    page_number=section.page_number,
                    section=section.section,
                    source_position=section.source_position,
                    token_count=_estimate_token_count(content),
                    content_hash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
                )
            )
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


def _extract_pdf_pages(content: bytes) -> list[str]:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise DocumentProcessingError("PDF 解析组件未安装，请先安装 backend/requirements.txt") from exc

    reader = PdfReader(BytesIO(content))
    return [_normalize_text(page.extract_text() or "") for page in reader.pages]


def _extract_pdf_text(content: bytes) -> str:
    return "\n".join(page for page in _extract_pdf_pages(content) if page)


def _extract_xlsx_text(content: bytes) -> str:
    try:
        with zipfile.ZipFile(BytesIO(content)) as archive:
            shared_strings = _read_xlsx_shared_strings(archive)
            texts: list[str] = []
            worksheet_names = sorted(
                name
                for name in archive.namelist()
                if name.startswith("xl/worksheets/") and name.endswith(".xml")
            )
            for name in worksheet_names:
                root = ET.fromstring(archive.read(name))
                for cell in root.iter():
                    if _local_name(cell.tag) != "c":
                        continue
                    inline_text = " ".join(_text_nodes(cell))
                    value_text = _first_child_text(cell, "v")
                    if cell.attrib.get("t") == "s" and value_text:
                        try:
                            shared_index = int(value_text)
                        except ValueError:
                            shared_index = -1
                        if 0 <= shared_index < len(shared_strings):
                            texts.append(shared_strings[shared_index])
                    elif inline_text:
                        texts.append(inline_text)
                    elif value_text:
                        texts.append(value_text)
    except (KeyError, zipfile.BadZipFile, ET.ParseError) as exc:
        raise DocumentProcessingError("XLSX 文档结构异常，无法解析") from exc

    normalized = "\n".join(text.strip() for text in texts if text.strip())
    if not normalized:
        raise DocumentProcessingError("XLSX 文档未提取到可入库文本")
    return normalized


def _read_xlsx_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        " ".join(_text_nodes(item)).strip()
        for item in root.iter()
        if _local_name(item.tag) == "si"
    ]


def _extract_pptx_text(content: bytes) -> str:
    try:
        with zipfile.ZipFile(BytesIO(content)) as archive:
            texts: list[str] = []
            slide_names = sorted(
                name
                for name in archive.namelist()
                if name.startswith("ppt/slides/") and name.endswith(".xml")
            )
            for name in slide_names:
                root = ET.fromstring(archive.read(name))
                texts.extend(_text_nodes(root))
    except (zipfile.BadZipFile, ET.ParseError) as exc:
        raise DocumentProcessingError("PPTX 文档结构异常，无法解析") from exc

    normalized = "\n".join(text.strip() for text in texts if text.strip())
    if not normalized:
        raise DocumentProcessingError("PPTX 文档未提取到可入库文本")
    return normalized


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


def _text_nodes(root: ET.Element) -> list[str]:
    return [
        node.text.strip()
        for node in root.iter()
        if _local_name(node.tag) == "t" and node.text and node.text.strip()
    ]


def _first_child_text(root: ET.Element, name: str) -> str:
    for node in root:
        if _local_name(node.tag) == name and node.text:
            return node.text.strip()
    return ""


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _find_breakpoint(text: str, start: int, end: int) -> int:
    search_start = start + max((end - start) // 2, 1)
    candidates = [
        text.rfind(separator, search_start, end)
        for separator in ("\n\n", "\n", "。", "；", ";", "，", ",", ".")
    ]
    return max(candidates)


def _detect_heading(text: str) -> str | None:
    for line in text.splitlines():
        candidate = line.strip()
        if not candidate:
            continue
        if len(candidate) <= 80:
            return candidate
        break
    return None


def _sections_from_lines(text: str, source_prefix: str = "section") -> tuple[ParsedSection, ...]:
    normalized = _normalize_text(text)
    if not normalized:
        return ()
    blocks = [block.strip() for block in re.split(r"\n{2,}", normalized) if block.strip()]
    if not blocks:
        blocks = [normalized]
    current_heading: str | None = None
    sections: list[ParsedSection] = []
    for index, block in enumerate(blocks, start=1):
        first_line = block.splitlines()[0].strip()
        if len(first_line) <= 80 and (
            re.match(r"^(第[一二三四五六七八九十百0-9]+[章节部分])", first_line)
            or first_line.startswith("#")
        ):
            current_heading = first_line.lstrip("# ")
        sections.append(
            ParsedSection(
                text=block,
                section=current_heading,
                source_position=f"{source_prefix}:{index}",
            )
        )
    return tuple(sections)


def _estimate_token_count(text: str) -> int:
    latin_words = len(re.findall(r"[A-Za-z0-9_]+", text))
    cjk_chars = len(re.findall(r"[\u4e00-\u9fff]", text))
    punctuation = len(re.findall(r"[^\w\s\u4e00-\u9fff]", text))
    return max(1, latin_words + cjk_chars + punctuation // 2)
