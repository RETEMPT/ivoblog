import os
import shutil

from fastapi import APIRouter, Request

from cms_core.security import atomic_copy_file, atomic_write_text, safe_join

router = APIRouter()

CURRENT_API_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_API_DIR, "..", ".."))
SOURCE_ROOT = os.path.realpath(PROJECT_ROOT)

SYNC_DIRS = ["posts", "chatters", "moments"]
SYNC_FILES = [
    "app/about/about.md",
    "data/albums.ts",
    "data/friends.ts",
    "data/projects.ts",
    "siteConfig.ts",
]
SYNC_UPLOADS = True  # public/uploads/ (cover images, music files, etc.)
SENSITIVE_CONFIG_MARKERS = ("picBedName:", "picBedUrl:", "picBedToken:", "图床核心配置")


def validate_blog_dir(target_path: str) -> tuple[bool, str, str]:
    if not target_path:
        return False, "Target path is empty.", ""

    target_root = os.path.realpath(os.path.abspath(target_path))
    if not os.path.exists(target_root):
        return False, "Target path does not exist.", target_root

    try:
        inside_source_root = os.path.commonpath([SOURCE_ROOT, target_root]) == SOURCE_ROOT
    except ValueError:
        inside_source_root = False
    if inside_source_root:
        return False, "Blocked: target path cannot be inside the manager project.", target_root

    if not os.path.isfile(os.path.join(target_root, "package.json")):
        return False, "Target path is not a valid frontend project.", target_root

    return True, "", target_root


def mirror_directory(src_dir: str, dst_dir: str) -> None:
    src_real = os.path.realpath(src_dir)
    dst_real = os.path.realpath(dst_dir)
    if src_real == dst_real:
        raise ValueError("Source and target directories are the same.")
    os.makedirs(os.path.dirname(dst_real), exist_ok=True)
    if os.path.exists(dst_real):
        shutil.rmtree(dst_real)
    shutil.copytree(src_real, dst_real)


@router.post("/check")
async def check_blog_path(request: Request):
    try:
        payload = await request.json()
        target_path = payload.get("blogPath", "").strip()

        valid, message, target_root = validate_blog_dir(target_path)
        if not valid:
            return {"success": False, "message": message}

        missing = []
        for dirname in ["posts", "data", "app"]:
            if not os.path.exists(safe_join(target_root, dirname)):
                missing.append(dirname)

        if missing:
            return {
                "success": True,
                "message": f"Path is valid. Missing folders will be created: {', '.join(missing)}.",
            }

        return {"success": True, "message": "Path validation passed."}
    except Exception as e:
        return {"success": False, "message": f"Validation failed: {str(e)}"}


@router.post("/execute")
async def execute_sync(request: Request):
    try:
        payload = await request.json()
        target_path = payload.get("blogPath", "").strip()

        valid, message, target_root = validate_blog_dir(target_path)
        if not valid:
            return {"success": False, "message": message}

        for dirname in SYNC_DIRS:
            src_dir = safe_join(PROJECT_ROOT, dirname)
            dst_dir = safe_join(target_root, dirname)

            if os.path.exists(src_dir):
                mirror_directory(src_dir, dst_dir)

        for rel_path in SYNC_FILES:
            local_rel_path = rel_path.replace("/", os.sep)
            src_file = safe_join(PROJECT_ROOT, local_rel_path)
            dst_file = safe_join(target_root, local_rel_path)

            if not os.path.exists(src_file):
                continue

            os.makedirs(os.path.dirname(dst_file), exist_ok=True)
            if rel_path == "siteConfig.ts":
                with open(src_file, "r", encoding="utf-8") as file_in:
                    filtered = [
                        line
                        for line in file_in
                        if not any(marker in line for marker in SENSITIVE_CONFIG_MARKERS)
                    ]
                atomic_write_text(dst_file, "".join(filtered))
            else:
                atomic_copy_file(src_file, dst_file)

        # Mirror public/uploads/ so stale uploaded assets do not linger in the target blog.
        if SYNC_UPLOADS:
            src_uploads = safe_join(PROJECT_ROOT, "public", "uploads")
            dst_uploads = safe_join(target_root, "public", "uploads")
            if os.path.isdir(src_uploads):
                mirror_directory(src_uploads, dst_uploads)

        return {"success": True, "message": "Content, config and uploads mirrored to target blog."}
    except Exception as e:
        return {"success": False, "message": f"Sync failed: {str(e)}"}
