import ipaddress
import json
import os
import re
import shutil
import socket
import tempfile
from pathlib import Path
from urllib.parse import urlparse


SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")
SAFE_GIT_BRANCH_RE = re.compile(r"^[A-Za-z0-9._/-]+$")


def validate_safe_id(value: object, field_name: str = "id") -> str:
    safe_value = str(value or "").strip()
    if not SAFE_ID_RE.fullmatch(safe_value):
        raise ValueError(f"Invalid {field_name}. Use letters, numbers, underscores, or hyphens only.")
    return safe_value


def validate_git_branch(value: object, default: str = "main") -> str:
    branch = str(value or default).strip()
    if (
        not SAFE_GIT_BRANCH_RE.fullmatch(branch)
        or ".." in branch
        or branch.startswith(("/", "-", "."))
        or branch.endswith(("/", ".", ".lock"))
    ):
        raise ValueError("Invalid git branch name.")
    return branch


def safe_join(base_dir: str, *parts: str) -> str:
    base_real = os.path.realpath(base_dir)
    target_real = os.path.realpath(os.path.join(base_real, *parts))
    if os.path.commonpath([base_real, target_real]) != base_real:
        raise ValueError("Path escapes the allowed directory.")
    return target_real


def atomic_write_text(path: str | Path, content: str, encoding: str = "utf-8") -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(prefix=f".{target.name}.", suffix=".tmp", dir=str(target.parent))
    try:
        with os.fdopen(fd, "w", encoding=encoding, newline="") as temp_file:
            temp_file.write(content)
            temp_file.flush()
            os.fsync(temp_file.fileno())
        os.replace(temp_path, target)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def atomic_write_bytes(path: str | Path, content: bytes) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(prefix=f".{target.name}.", suffix=".tmp", dir=str(target.parent))
    try:
        with os.fdopen(fd, "wb") as temp_file:
            temp_file.write(content)
            temp_file.flush()
            os.fsync(temp_file.fileno())
        os.replace(temp_path, target)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def atomic_write_json(path: str | Path, data: object, indent: int = 2) -> None:
    atomic_write_text(path, json.dumps(data, ensure_ascii=False, indent=indent))


def atomic_copy_file(src: str | Path, dst: str | Path) -> None:
    target = Path(dst)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(prefix=f".{target.name}.", suffix=".tmp", dir=str(target.parent))
    os.close(fd)
    try:
        shutil.copy2(src, temp_path)
        os.replace(temp_path, target)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def validate_public_https_url(raw_url: object) -> str:
    url = str(raw_url or "").strip().rstrip("/")
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError("Remote URL must use https and include a hostname.")
    if parsed.username or parsed.password:
        raise ValueError("Remote URL must not include credentials.")

    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError("Remote URL hostname could not be resolved.") from exc

    for family, _, _, _, sockaddr in addresses:
        host = sockaddr[0]
        try:
            ip = ipaddress.ip_address(host)
        except ValueError as exc:
            raise ValueError("Remote URL resolved to an invalid address.") from exc
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise ValueError("Remote URL must resolve to a public address.")

    return url
