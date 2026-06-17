import hmac
import ipaddress
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from cms_core.api import config, deploy, drafts, friends, gallery, logs, moments, music, picbed, projects, sync

app = FastAPI(title="iV0 Blog Manager API", version="1.0.0")


def is_loopback_host(host: str | None) -> bool:
    if not host:
        return False
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return host in {"localhost", "127.0.0.1", "::1"}


@app.middleware("http")
async def require_api_key(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path == "/api/status":
        return await call_next(request)

    expected_key = os.environ.get("CMS_API_KEY", "").strip()
    if expected_key:
        provided_key = request.headers.get("X-CMS-API-Key", "")
        if not hmac.compare_digest(provided_key, expected_key):
            return JSONResponse(status_code=401, content={"success": False, "message": "Unauthorized"})
    elif not is_loopback_host(request.client.host if request.client else None):
        return JSONResponse(
            status_code=403,
            content={"success": False, "message": "CMS_API_KEY is required for non-local access"},
        )

    return await call_next(request)


@app.middleware("http")
async def log_unhandled_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": str(exc)},
        )
    except Exception as exc:
        logs.add_log("err", f"Unhandled API error {request.method} {request.url.path}: {exc}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Internal server error"},
        )


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*", "X-CMS-API-Key"],
)


@app.get("/api/status")
def get_status():
    return {"status": "online", "message": "CMS backend is online"}


app.include_router(music.router, prefix="/api/music", tags=["Music"])
app.include_router(config.router, prefix="/api/config", tags=["Config"])
app.include_router(picbed.router, prefix="/api/picbed", tags=["PicBed"])
app.include_router(drafts.router, prefix="/api/drafts", tags=["Drafts"])
app.include_router(gallery.router, prefix="/api/gallery", tags=["Gallery"])
app.include_router(friends.router, prefix="/api/friends", tags=["Friends"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(moments.router, prefix="/api/moments", tags=["Moments"])
app.include_router(sync.router, prefix="/api/sync", tags=["Sync"])
app.include_router(deploy.router, prefix="/api/deploy", tags=["Deploy"])
app.include_router(logs.router, tags=["Logs"])
