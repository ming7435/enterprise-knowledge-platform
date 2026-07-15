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

    def delete(self, file_path: str | None) -> None:
        raise NotImplementedError

    def read(self, file_path: str) -> bytes:
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

    def delete(self, file_path: str | None) -> None:
        if not file_path:
            return
        target_path = Path(file_path)
        if target_path.exists() and target_path.is_file():
            target_path.unlink()

    def read(self, file_path: str) -> bytes:
        target_path = Path(file_path)
        if not target_path.exists() or not target_path.is_file():
            raise FileNotFoundError(f"文档文件不存在：{file_path}")
        return target_path.read_bytes()


class MinioDocumentStorage(DocumentStorage):
    def __init__(self, settings: Settings):
        try:
            from minio import Minio
        except ImportError as exc:
            raise RuntimeError("MinIO SDK 未安装") from exc

        if not settings.minio_access_key or not settings.minio_secret_key:
            raise RuntimeError("MinIO 账号未配置")

        import urllib3
        from urllib3.util import Retry, Timeout

        parsed = urlparse(settings.minio_endpoint)
        endpoint = parsed.netloc or parsed.path
        secure = settings.minio_secure or parsed.scheme == "https"
        self.bucket = settings.minio_bucket
        http_client = urllib3.PoolManager(
            timeout=Timeout(connect=1.0, read=2.0),
            retries=Retry(total=1, connect=1, read=0, redirect=0),
        )
        self.client = Minio(
            endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=secure,
            http_client=http_client,
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

    def delete(self, file_path: str | None) -> None:
        if not file_path or not file_path.startswith("minio://"):
            return
        without_scheme = file_path.removeprefix("minio://")
        bucket, _, object_name = without_scheme.partition("/")
        if bucket and object_name:
            self.client.remove_object(bucket, object_name)

    def read(self, file_path: str) -> bytes:
        if not file_path.startswith("minio://"):
            raise FileNotFoundError(f"MinIO 文件地址无效：{file_path}")
        without_scheme = file_path.removeprefix("minio://")
        bucket, _, object_name = without_scheme.partition("/")
        response = self.client.get_object(bucket, object_name)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()


def delete_document_file(settings: Settings, file_path: str | None) -> None:
    if not file_path:
        return
    try:
        if file_path.startswith("minio://"):
            MinioDocumentStorage(settings).delete(file_path)
        else:
            LocalDocumentStorage(settings.local_storage_root).delete(file_path)
    except Exception:
        return


def read_document_file(settings: Settings, file_path: str | None) -> bytes:
    if not file_path:
        raise FileNotFoundError("文档没有可读取的存储地址")
    if file_path.startswith("minio://"):
        return MinioDocumentStorage(settings).read(file_path)
    return LocalDocumentStorage(settings.local_storage_root).read(file_path)


def create_document_storage(settings: Settings) -> DocumentStorage:
    if settings.file_storage.lower() in {"minio", "auto"}:
        try:
            return MinioDocumentStorage(settings)
        except Exception:
            return LocalDocumentStorage(settings.local_storage_root)
    return LocalDocumentStorage(settings.local_storage_root)
