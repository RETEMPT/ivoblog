import os
import shutil

from fastapi import APIRouter, Request

from cms_core.security import atomic_copy_file, atomic_write_text

router = APIRouter()

CURRENT_API_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_API_DIR, "..", ".."))

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


def is_safe_blog_dir(target_path: str) -> bool:
    return bool(target_path) and os.path.exists(os.path.join(target_path, "package.json"))


@router.post("/check")
async def check_blog_path(request: Request):
    try:
        payload = await request.json()
        target_path = payload.get("blogPath", "").strip()

        if not target_path or not os.path.exists(target_path):
            return {"success": False, "message": "Target path does not exist."}

        if not is_safe_blog_dir(target_path):
            return {"success": False, "message": "Target path is not a valid frontend project."}

        missing = []
        for dirname in ["posts", "data", "app"]:
            if not os.path.exists(os.path.join(target_path, dirname)):
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

        if not is_safe_blog_dir(target_path):
            return {"success": False, "message": "Blocked: target path is invalid."}

        for dirname in SYNC_DIRS:
            src_dir = os.path.join(PROJECT_ROOT, dirname)
            dst_dir = os.path.join(target_path, dirname)

            if os.path.exists(src_dir):
                if os.path.exists(dst_dir):
                    shutil.rmtree(dst_dir)
                shutil.copytree(src_dir, dst_dir)

        for rel_path in SYNC_FILES:
            src_file = os.path.join(PROJECT_ROOT, rel_path.replace("/", os.sep))
            dst_file = os.path.join(target_path, rel_path.replace("/", os.sep))

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

        # Merge public/uploads/ (non-destructive — only adds/updates, never deletes)
        if SYNC_UPLOADS:
            src_uploads = os.path.join(PROJECT_ROOT, "public", "uploads")
            dst_uploads = os.path.join(target_path, "public", "uploads")
            if os.path.isdir(src_uploads):
                os.makedirs(dst_uploads, exist_ok=True)
                for item in os.listdir(src_uploads):
                    s = os.path.join(src_uploads, item)
                    d = os.path.join(dst_uploads, item)
                    if os.path.isdir(s):
                        shutil.copytree(s, d, dirs_exist_ok=True)
                    else:
                        shutil.copy2(s, d)

        return {"success": True, "message": "Content, config and uploads synced to target blog."}
    except Exception as e:
        return {"success": False, "message": f"Sync failed: {str(e)}"}
