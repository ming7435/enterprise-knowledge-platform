from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse
import re

from app.core.config import Settings


def safe_filename(filename: str) -> str:
    name = Path(filename).name.strip() or "document"
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)


def file_extension(filename: str, content_type: str | None = None) -> str:
    suffix = Path(filename).suffix.lower().lstrip(".")
    if suffix:
        return suffix[:50]
    if content_type and "/" in content_type:
        return content_type.split("/", 1)[1].split(";", 1)[0][:50] or "unknown"
    return "unknown"


class DocumentStorage:
    def save(
        self,
        *,
        workspace_id: str,
        document_id: str,
        filename: str,
        content: bytes,
        content_type: str | None,
    ) -> str:
        raise NotImplementedError


class LocalDocumentStorage(DocumentStorage):
    def __init__(self, root: str):
        self.root = Path(root)

    def save(
        self,
        *,
        workspace_id: str,
        document_id: str,
        filename: str,
        content: bytes,
        content_type: str | None,
    ) -> str:
        target_dir = self.root / workspace_id / document_id
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / safe_filename(filename)
        target_path.write_bytes(content)
        return str(target_path)


class MinioDocumentStorage(DocumentStorage):
    def __init__(self, settings: Settings):
        try:
            from minio import Minio
        except ImportError as exc:
            raise RuntimeError("MinIO SDK 未安装") from exc

        if not settings.minio_access_key or not settings.minio_secret_key:
            raise RuntimeError("MinIO 账号未配置")

        parsed = urlparse(settings.minio_endpoint)
        endpoint = parsed.netloc or parsed.path
        secure = settings.minio_secure or parsed.scheme == "https"
        self.bucket = settings.minio_bucket
        self.client = Minio(
            endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=secure,
        )

    def save(
        self,
        *,
        workspace_id: str,
        document_id: str,
        filename: str,
        content: bytes,
        content_type: str | None,
    ) -> str:
        from io import BytesIO

        found = self.client.bucket_exists(self.bucket)
        if not found:
            self.client.make_bucket(self.bucket)

        object_name = "/".join(
            ["workspaces", workspace_id, "documents", document_id, safe_filename(filename)]
        )
        self.client.put_object(
            self.bucket,
            object_name,
            BytesIO(content),
            length=len(content),
            content_type=content_type or "application/octet-stream",
        )
        return f"minio://{self.bucket}/{object_name}"


def create_document_storage(settings: Settings) -> DocumentStorage:
    if settings.file_storage.lower() in {"minio", "auto"}:
        try:
            return MinioDocumentStorage(settings)
        except Exception:
            return LocalDocumentStorage(settings.local_storage_root)
    return LocalDocumentStorage(settings.local_storage_root)
