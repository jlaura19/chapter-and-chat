import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from .config import get_settings

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}

UPLOAD_ROOT = Path(get_settings().upload_dir).resolve()
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


async def save_image(upload: UploadFile, folder: str, max_bytes: int) -> str:
    extension = ALLOWED_IMAGE_TYPES.get(upload.content_type or "")
    if extension is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only JPEG, PNG, GIF, or WEBP images are allowed")
    data = await upload.read(max_bytes + 1)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file is empty")
    if len(data) > max_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image is too large")
    target_dir = UPLOAD_ROOT / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (target_dir / filename).write_bytes(data)
    return f"/uploads/{folder}/{filename}"


def delete_upload(url: str | None) -> None:
    """Remove a stored upload. Only paths inside UPLOAD_ROOT are touched."""
    if not url or not url.startswith("/uploads/"):
        return
    path = (UPLOAD_ROOT / url.removeprefix("/uploads/")).resolve()
    if UPLOAD_ROOT in path.parents and path.is_file():
        path.unlink()
