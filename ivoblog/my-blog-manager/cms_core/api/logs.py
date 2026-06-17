"""Ring-buffer log capture served as live terminal feed for the manager UI."""
from __future__ import annotations

import sys
import threading
from collections import deque
from datetime import datetime, timezone
from io import StringIO

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

router = APIRouter()

MAX_LINES = 500
_BUFFER: deque[str] = deque(maxlen=MAX_LINES)
_LOCK = threading.Lock()
_INSTALLED = False

# Only suppress *successful* polling requests that would flood the log.
# Errors and mutations are always kept.
_QUIET_SUCCESS_POLLS = (
    '"GET /api/logs/recent',
    '"GET /api/deploy/config',
    '"GET /api/config/deepseek-key/status',
    '"GET /api/music/login/status',
    '"OPTIONS ',
)

# Config GET is kept for diagnostics but rate-limited.
# Operations that should always appear when they succeed:
_ALWAYS_LOG = (
    "ERROR",
    "WARNING",
    "Traceback",
    "Exception",
    "Started server process",
    "Application startup complete",
    "Uvicorn running",
    "POST ",
    "PUT ",
    "DELETE ",
    "PATCH ",
    "[client:",
    "[ops]",
)


def _format(stream: str, text: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    return f"[{ts}] [{stream}] {text.rstrip()}"


_last_captured: dict[str, float] = {}
_RATE_LIMIT_SECONDS = 2.0  # per unique stripped line


def add_log(stream: str, text: str) -> None:
    with _LOCK:
        for line in str(text).splitlines() or [str(text)]:
            if _should_capture(line):
                now = datetime.now(timezone.utc).timestamp()
                key = line.strip()
                last = _last_captured.get(key, 0)
                if now - last >= _RATE_LIMIT_SECONDS or any(p in key for p in ("ERROR", "Traceback", "Exception", "[ops]")):
                    _last_captured[key] = now
                    _BUFFER.append(_format(stream, line))
                # else: rate-limited duplicate, skip


def _should_capture(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False

    # NEVER suppress errors or explicit operational logs
    if any(p in stripped for p in ("ERROR", "Traceback", "Exception", "[ops]", "[client:error]")):
        return True

    # Always capture mutations and important events
    if any(p in stripped for p in _ALWAYS_LOG):
        # But still rate-limit duplicate GET polling
        if '"GET /api/config/get' in stripped and '" 200 OK' in stripped:
            return True  # allow but rate-limited by add_log
        return True

    # Suppress only successful quiet polls
    for pattern in _QUIET_SUCCESS_POLLS:
        if pattern in stripped and '" 200' in stripped:
            return False

    return True


def _install() -> None:
    global _INSTALLED
    if _INSTALLED:
        return
    _INSTALLED = True

    class _Teed(StringIO):
        def __init__(self, label: str, original):
            super().__init__()
            self._label = label
            self._orig = original

        def write(self, s: str) -> int:
            if s and s.strip():
                with _LOCK:
                    for line in s.splitlines():
                        if _should_capture(line):
                            _BUFFER.append(_format(self._label, line))
            return self._orig.write(s)

        def flush(self) -> None:
            return self._orig.flush()

    sys.stdout = _Teed("out", sys.stdout)
    sys.stderr = _Teed("err", sys.stderr)


@router.get("/api/logs/recent")
async def recent(limit: int = 200, after: int = -1):
    with _LOCK:
        lines = list(_BUFFER)

    start = max(0, after + 1) if after >= 0 else max(0, len(lines) - limit)
    chunk = lines[start:]
    return JSONResponse({"lines": chunk, "cursor": start + len(chunk) - 1, "total": len(lines)})


@router.post("/api/logs/client")
async def client_log(payload: dict = Body(...)):
    level = str(payload.get("level", "info")).lower()[:16]
    source = str(payload.get("source", "client"))[:80]
    message = str(payload.get("message", ""))[:2000]
    detail = payload.get("detail")

    if detail is not None:
        try:
            detail_text = str(detail)[:2000]
        except Exception:
            detail_text = "<unserializable>"
        message = f"{message} | {detail_text}"

    add_log("client", f"[client:{level}] {source}: {message}")
    return {"success": True}


@router.post("/api/logs/clear")
async def clear_logs():
    with _LOCK:
        _BUFFER.clear()
    return {"success": True}


# Install the tee once on import so logs accumulate from the very beginning.
_install()
