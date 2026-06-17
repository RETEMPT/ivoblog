import os
from typing import List, Optional

import yaml
from fastapi import APIRouter
from pydantic import BaseModel

from cms_core.security import atomic_write_text, safe_join, validate_safe_id

router = APIRouter()

CURRENT_API_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_API_DIR, "..", ".."))
MOMENTS_DIR = os.path.join(PROJECT_ROOT, "moments")


class MomentPayload(BaseModel):
    id: str
    date: str
    content: str
    location: Optional[str] = ""
    images: List[str] = []


class DeletePayload(BaseModel):
    id: str


def get_moment_path(moment_id: str) -> str:
    safe_id = validate_safe_id(moment_id, "moment id")
    return safe_join(MOMENTS_DIR, f"{safe_id}.md")


@router.post("/save")
def save_moment(payload: MomentPayload):
    try:
        os.makedirs(MOMENTS_DIR, exist_ok=True)
        safe_id = validate_safe_id(payload.id, "moment id")
        file_path = get_moment_path(safe_id)
        frontmatter = {
            "id": safe_id,
            "date": payload.date,
            "location": payload.location or "",
            "images": payload.images,
        }
        file_content = f"---\n{yaml.safe_dump(frontmatter, allow_unicode=True, sort_keys=False)}---\n\n{payload.content}"
        atomic_write_text(file_path, file_content)
        print(f"\n[success] moment saved: {file_path}\n")
        return {"success": True, "message": f"Saved to {file_path}"}
    except Exception as e:
        print(f"\n[error] moment write failed: {str(e)}\n")
        return {"success": False, "message": f"Write moment failed: {str(e)}"}


@router.post("/delete")
def delete_moment(payload: DeletePayload):
    try:
        file_path = get_moment_path(payload.id)
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"\n[success] moment deleted: {file_path}\n")
            return {"success": True, "message": "File deleted"}
        return {"success": False, "message": "File does not exist"}
    except Exception as e:
        print(f"\n[error] moment delete failed: {str(e)}\n")
        return {"success": False, "message": f"Delete failed: {str(e)}"}
