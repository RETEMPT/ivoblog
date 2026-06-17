from fastapi import APIRouter, Body, File, Form, UploadFile
from pathlib import Path
import mimetypes
import re
import uuid

from cms_core.security import atomic_write_bytes

router = APIRouter()

CURRENT_API_DIR = Path(__file__).resolve().parent
MANAGER_ROOT = CURRENT_API_DIR.parent.parent
BLOG_ROOT = MANAGER_ROOT.parent / "blog"
UPLOAD_DIR = Path("uploads") / "images"
MAX_IMAGE_BYTES = 15 * 1024 * 1024

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "image/avif": ".avif",
}


@router.post("/test")
async def test_picbed_connection(payload: dict = Body(...)):
    return {
        "success": True,
        "message": "Local upload mode is enabled. Images are saved to /public/uploads/images.",
        "storage": "local",
    }


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    url: str = Form(""),
    token: str = Form(""),
):
    content = await file.read()
    validation_error = validate_image(file, content)
    if validation_error:
        return {"success": False, "message": validation_error}

    return local_upload_response(file, content, "Image saved locally.")


def validate_image(file: UploadFile, content: bytes):
    if not content:
        return "Image is empty."
    if len(content) > MAX_IMAGE_BYTES:
        return "Image is too large; keep it under 15MB."
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        return "Only jpg, png, webp, gif, svg, and avif images are supported."
    return ""


def safe_filename(file: UploadFile):
    original = Path(file.filename or "image").stem
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "-", original).strip("-")[:40] or "image"
    guessed_ext = mimetypes.guess_extension(file.content_type or "") or ""
    ext = ALLOWED_IMAGE_TYPES.get(file.content_type or "", guessed_ext) or ".img"
    return f"{safe_stem}-{uuid.uuid4().hex[:10]}{ext}"


def save_local_image(file: UploadFile, content: bytes):
    filename = safe_filename(file)
    public_roots = [MANAGER_ROOT / "public"]
    if BLOG_ROOT.exists():
        public_roots.append(BLOG_ROOT / "public")

    for public_root in public_roots:
        target_dir = public_root / UPLOAD_DIR
        target_dir.mkdir(parents=True, exist_ok=True)
        atomic_write_bytes(target_dir / filename, content)

    return f"/uploads/images/{filename}"


def local_upload_response(file: UploadFile, content: bytes, message: str):
    return {
        "success": True,
        "message": message,
        "url": save_local_image(file, content),
        "storage": "local",
    }
