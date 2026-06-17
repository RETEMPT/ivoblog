from fastapi import APIRouter, Body
import json
import os
import re
import threading
from typing import Any, Dict
from cms_core.security import atomic_write_text

router = APIRouter()

CURRENT_API_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_API_DIR, "..", ".."))
BLOG_ROOT = os.path.abspath(os.path.join(PROJECT_ROOT, "..", "blog"))
DEEPSEEK_ENV_KEY = "DEEPSEEK_API_KEY"
CONFIG_WRITE_LOCK = threading.Lock()

VALID_ROOT_KEYS = {
    "title",
    "authorName",
    "bio",
    "avatarUrl",
    "faviconUrl",
    "navTitle",
    "navSuffix",
    "navAfter",
    "useGradient",
    "themeColors",
    "bgImages",
    "defaultPostCover",
    "photoWallImage",
    "cloudMusicIds",
    "musicPlaybackMode",
    "effectsConfig",
    "homeDockConfig",
    "chatterTitle",
    "chatterDescription",
    "picBedName",
    "picBedUrl",
    "picBedToken",
    "danmakuList",
    "gitalkConfig",
    "buildDate",
    "footerBadges",
    "icpConfig",
    "deepseekConfig",
    "friendLinkApplyFormat",
    "enableLevelSystem",
}


def config_path(root: str) -> str:
    return os.path.join(root, "siteConfig.ts")


def get_config_path() -> str | None:
    path = config_path(PROJECT_ROOT)
    return path if os.path.exists(path) else None


def get_config_paths() -> list[str]:
    paths = []
    manager_path = config_path(PROJECT_ROOT)
    blog_path = config_path(BLOG_ROOT)
    if os.path.exists(manager_path):
        paths.append(manager_path)
    if os.path.exists(blog_path):
        paths.append(blog_path)
    return list(dict.fromkeys(paths))


def get_env_targets() -> list[str]:
    targets = [os.path.join(PROJECT_ROOT, ".env.local")]
    if os.path.isdir(BLOG_ROOT):
        targets.append(os.path.join(BLOG_ROOT, ".env.local"))
    return list(dict.fromkeys(os.path.abspath(path) for path in targets))


def read_env_value(path: str, key: str) -> str:
    if not os.path.exists(path):
        return ""
    pattern = re.compile(rf"^\s*{re.escape(key)}\s*=\s*(.*)\s*$")
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            match = pattern.match(line)
            if not match:
                continue
            value = match.group(1).strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            return value
    return ""


def write_env_value(path: str, key: str, value: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    safe_value = value.replace("\r", "").replace("\n", "").strip()
    pattern = re.compile(rf"^\s*{re.escape(key)}\s*=")
    lines: list[str] = []
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()

    output: list[str] = []
    replaced = False
    for line in lines:
        if pattern.match(line):
            if not replaced:
                output.append(f"{key}={safe_value}\n")
                replaced = True
            continue
        output.append(line)

    if not replaced:
        if output and not output[-1].endswith("\n"):
            output[-1] += "\n"
        output.append(f"{key}={safe_value}\n")

    atomic_write_text(path, "".join(output))


def mask_secret(value: str) -> str:
    if not value:
        return ""
    return "saved"


def coerce_literal(value: str) -> Any:
    value = value.strip()
    if value == "true":
        return True
    if value == "false":
        return False
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    if re.fullmatch(r"-?\d+\.\d+", value):
        return float(value)
    return value


def parse_string_array(raw: str) -> list[str]:
    return [match.group(1) for match in re.finditer(r'["\']([\s\S]*?)["\']', raw)]


def parse_object(raw: str) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    for match in re.finditer(r"([a-zA-Z0-9_]+)\s*:\s*(\[[\s\S]*?\]|[\"']([\s\S]*?)[\"']|true|false|-?\d+(?:\.\d+)?)", raw):
        key = match.group(1)
        token = match.group(2).strip()
        if token.startswith("["):
            data[key] = parse_string_array(token)
        elif token.startswith(("'", '"')):
            data[key] = match.group(3).replace("\\n", "\n") if match.group(3) is not None else ""
        else:
            data[key] = coerce_literal(token)
    return data


def extract_block(content: str, key: str, open_char: str, close_char: str) -> str:
    start_match = re.search(rf"{re.escape(key)}\s*:\s*\{open_char}", content)
    if not start_match:
        return ""
    start = start_match.end() - 1
    depth = 0
    quote = ""
    escaped = False
    for index in range(start, len(content)):
        char = content[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = ""
            continue
        if char in ("'", '"', "`"):
            quote = char
            continue
        if char == open_char:
            depth += 1
        elif char == close_char:
            depth -= 1
            if depth == 0:
                return content[start + 1:index]
    return ""


def get_site_config_data(content: str) -> Dict[str, Any]:
    parsed: Dict[str, Any] = {}

    for key in ["themeColors", "bgImages", "cloudMusicIds", "danmakuList"]:
        block = extract_block(content, key, "[", "]")
        if block:
            parsed[key] = parse_string_array(block)

    for key in ["effectsConfig", "homeDockConfig", "gitalkConfig", "icpConfig", "deepseekConfig"]:
        block = extract_block(content, key, "{", "}")
        if block:
            parsed[key] = parse_object(block)

    root_content = content
    for key in ["themeColors", "bgImages", "cloudMusicIds", "danmakuList", "footerBadges"]:
        root_content = re.sub(rf"{key}\s*:\s*\[[\s\S]*?\],?", "", root_content, count=1)
    for key in ["effectsConfig", "homeDockConfig", "gitalkConfig", "icpConfig", "deepseekConfig"]:
        block = extract_block(root_content, key, "{", "}")
        if block:
            root_content = root_content.replace(f"{key}: {{{block}}}", "")

    for match in re.finditer(r"([a-zA-Z0-9_]+)\s*:\s*(?:([\"'])([\s\S]*?)\2|(true|false|-?\d+(?:\.\d+)?))", root_content):
        key = match.group(1)
        if key in parsed:
            continue
        if match.group(3) is not None:
            parsed[key] = match.group(3).replace("\\n", "\n")
        else:
            parsed[key] = coerce_literal(match.group(4))

    return parsed


def ts_value(value: Any, indent: int = 2) -> str:
    if isinstance(value, dict):
        lines = ["{"]
        for key, item in value.items():
            lines.append(f"{' ' * (indent + 2)}{key}: {ts_value(item, indent + 2)},")
        lines.append(" " * indent + "}")
        return "\n".join(lines)
    if isinstance(value, bool):
        return "true" if value else "false"
    return json.dumps(value, ensure_ascii=False)


def replace_config_value(content: str, key: str, value: Any) -> tuple[str, bool]:
    if key not in VALID_ROOT_KEYS:
        return content, False

    rendered = ts_value(value, 2)
    if isinstance(value, dict):
        pattern = rf"({re.escape(key)}\s*:\s*)\{{[\s\S]*?\}}"
    elif isinstance(value, list):
        pattern = rf"({re.escape(key)}\s*:\s*)\[[\s\S]*?\]"
    else:
        pattern = rf"({re.escape(key)}\s*:\s*)([\"'`][\s\S]*?[\"'`]|true|false|-?\d+(?:\.\d+)?)"

    next_content, count = re.subn(pattern, lambda m: m.group(1) + rendered, content, count=1)
    return next_content, count > 0


@router.get("/get")
def get_site_config():
    path = get_config_path()
    if not path:
        return {"success": False, "message": "siteConfig.ts not found"}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return {"success": True, "data": get_site_config_data(f.read())}
    except Exception as exc:
        return {"success": False, "message": f"Read config failed: {exc}"}


@router.post("/update")
def update_site_config(payload: Dict[str, Any] = Body(...)):
    updates = payload.get("updates", {})
    if not isinstance(updates, dict) or not updates:
        return {"success": False, "message": "No updates received"}

    with CONFIG_WRITE_LOCK:
        try:
            targets = []
            updated_total = 0
            for path in get_config_paths():
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()

                updated_count = 0
                for key, value in updates.items():
                    if key == "cloudMusicIds" and isinstance(value, list):
                        value = [str(item) for item in value if re.fullmatch(r"\d{3,}", str(item))][:50]
                    content, changed = replace_config_value(content, key, value)
                    if changed:
                        updated_count += 1

                if updated_count > 0:
                    atomic_write_text(path, content)
                targets.append({"path": path, "updated": updated_count})
                updated_total += updated_count

            return {
                "success": updated_total > 0,
                "message": "Config saved to manager and blog.",
                "updated": updated_total,
                "targets": targets,
            }
        except Exception as exc:
            return {"success": False, "message": f"Write config failed: {exc}"}


@router.get("/deepseek-key/status")
def get_deepseek_key_status():
    try:
        targets = []
        first_value = ""
        for path in get_env_targets():
            value = read_env_value(path, DEEPSEEK_ENV_KEY)
            if value and not first_value:
                first_value = value
            targets.append({"path": path, "exists": os.path.exists(path), "hasKey": bool(value)})
        return {
            "success": True,
            "envKey": DEEPSEEK_ENV_KEY,
            "hasKey": bool(first_value),
            "maskedKey": mask_secret(first_value),
            "targets": targets,
        }
    except Exception as exc:
        return {"success": False, "message": f"Read API key status failed: {exc}"}


@router.post("/deepseek-key")
def update_deepseek_key(payload: Dict[str, Any] = Body(...)):
    api_key = str(payload.get("apiKey", "")).strip()
    if not api_key:
        return {"success": False, "message": "API key cannot be empty"}
    if "\n" in api_key or "\r" in api_key:
        return {"success": False, "message": "API key cannot contain line breaks"}
    if len(api_key) < 8:
        return {"success": False, "message": "API key looks too short"}

    try:
        targets = get_env_targets()
        with CONFIG_WRITE_LOCK:
            for path in targets:
                write_env_value(path, DEEPSEEK_ENV_KEY, api_key)
        return {
            "success": True,
            "message": "API key saved to local .env.local files.",
            "envKey": DEEPSEEK_ENV_KEY,
            "targets": targets,
            "maskedKey": mask_secret(api_key),
        }
    except Exception as exc:
        return {"success": False, "message": f"Write API key failed: {exc}"}
