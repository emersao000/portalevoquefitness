from __future__ import annotations
import os
import pathlib
import re
from datetime import datetime
from typing import Optional

try:
    from azure.storage.blob import BlobServiceClient, ContentSettings
except Exception:  # pragma: no cover
    BlobServiceClient = None  # type: ignore
    ContentSettings = None  # type: ignore


_filename_sanitize_re = re.compile(r"[^A-Za-z0-9._-]+")

def _safe_filename(name: str) -> str:
    base = pathlib.Path(name or "arquivo").name
    # Normalize spaces and strip
    base = _filename_sanitize_re.sub("_", base).strip("._-") or "arquivo"
    # Avoid overlong names
    if len(base) > 200:
        stem = pathlib.Path(base).stem[:150]
        suffix = pathlib.Path(base).suffix[:20]
        base = f"{stem}{suffix}"
    return base

class StorageError(RuntimeError):
    pass

class AzureBlobStorage:
    def __init__(self, connection_string: str, container: str):
        if BlobServiceClient is None:
            raise StorageError("azure-storage-blob não instalado")
        if not connection_string or not container:
            raise StorageError("Configuração do Azure Blob ausente")
        self._svc = BlobServiceClient.from_connection_string(connection_string)
        self._container = container
        try:
            container_client = self._svc.get_container_client(container)
            if not container_client.exists():
                container_client.create_container()
        except Exception as e:  # pragma: no cover
            raise StorageError(f"Falha ao acessar/criar container: {e}")

    def upload_bytes(self, blob_path: str, data: bytes, content_type: Optional[str] = None) -> str:
        blob_client = self._svc.get_blob_client(container=self._container, blob=blob_path)
        content_settings = None
        if content_type and ContentSettings is not None:
            content_settings = ContentSettings(content_type=content_type)
        blob_client.upload_blob(data, overwrite=True, content_settings=content_settings)
        return blob_client.url

    def delete_blob(self, blob_path: str) -> None:
        try:
            blob_client = self._svc.get_blob_client(container=self._container, blob=blob_path)
            blob_client.delete_blob()
        except Exception:
            # Best-effort delete; do not raise to avoid breaking workflows
            return


def get_storage() -> AzureBlobStorage:
    cs = os.getenv("AZURE_STORAGE_CONNECTION_STRING") or os.getenv("AZURE_BLOB_CONNECTION_STRING")
    container = os.getenv("AZURE_STORAGE_CONTAINER") or os.getenv("AZURE_BLOB_CONTAINER")
    if not cs or not container:
        raise StorageError("Defina AZURE_STORAGE_CONNECTION_STRING e AZURE_STORAGE_CONTAINER nas variáveis de ambiente")
    return AzureBlobStorage(cs, container)


def build_blob_name(kind: str, chamado_id: int, original_filename: str) -> str:
    ts = int(datetime.timestamp(datetime.now()))
    safe = _safe_filename(original_filename)
    return f"chamados/{chamado_id}/{ts}_{safe}"
