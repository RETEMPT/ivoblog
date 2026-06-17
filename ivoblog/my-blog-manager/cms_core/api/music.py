import hashlib
import json
import os
import re
import shutil
import struct
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List
from urllib.parse import quote

import requests
from fastapi import APIRouter, Body, File, Form, Query, UploadFile

from cms_core.api.logs import add_log

router = APIRouter()


def _op_log(action: str, detail: str = "", success: bool | None = None) -> None:
    status = " OK" if success is True else (" FAIL" if success is False else "")
    add_log("ops", f"[music]{status} {action}{' — ' + detail if detail else ''}")


NETEASE_TIMEOUT = 6
NETEASE_COOKIE_ENV_KEY = "NETEASE_MUSIC_COOKIE"
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
BLOG_ROOT = os.path.abspath(os.path.join(PROJECT_ROOT, "..", "blog"))
LOCAL_DEFAULT_COVER = "/uploads/images/music-default-cover.svg"
LOCAL_DEFAULT_AVATAR = "/uploads/images/IMG_20251123_160113-b59a780ebe.png"
COVER_DIR = "uploads/covers"
COVER_CACHE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days
NETEASE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
    ),
    "Referer": "https://music.163.com/",
}
NETEASE_SESSION = requests.Session()
NETEASE_SESSION.trust_env = False
AUDIO_FILE_LOCK = threading.Lock()


def _synchsafe_to_int(data: bytes) -> int:
    """Decode a 4-byte synchsafe integer (ID3v2 size field)."""
    val = 0
    for byte in data:
        val = (val << 7) | (byte & 0x7F)
    return val


def _read_id3v2(data: bytes) -> Dict[str, Any]:
    """Parse ID3v2 tags from raw MP3 bytes.
    Returns dict with keys: title, artist, album, cover_data, cover_mime.
    Falls back gracefully on any parse error.
    """
    result: Dict[str, Any] = {}
    if len(data) < 10 or data[:3] != b"ID3":
        return result

    try:
        ver_major = data[3]
        # ID3v2.4 uses synchsafe size; v2.3 uses regular 32-bit integer
        if ver_major >= 4:
            tag_size = _synchsafe_to_int(data[6:10])
        else:
            tag_size = struct.unpack(">I", data[6:10])[0]

        # Frame ID mapping
        FRAME_MAP = {
            b"TIT2": "title",
            b"TPE1": "artist",
            b"TPE2": "artist",
            b"TALB": "album",
            b"USLT": "lyrics",
            b"SYLT": "lyrics",
            b"APIC": "cover",
        }

        pos = 10  # after ID3v2 header
        tag_end = min(pos + tag_size, len(data))

        while pos + 10 <= tag_end:
            frame_id = data[pos:pos + 4]
            if frame_id == b"\x00\x00\x00\x00" or frame_id[0] == 0:
                break  # padding reached

            # ID3v2.3: 4-byte size; ID3v2.4: 4-byte synchsafe size
            ver_major = data[3]
            if ver_major >= 4:
                frame_size = _synchsafe_to_int(data[pos + 4:pos + 8])
            else:
                frame_size = struct.unpack(">I", data[pos + 4:pos + 8])[0]

            if frame_size <= 0 or pos + 10 + frame_size > tag_end:
                pos += 1  # skip and try realign
                continue

            frame_flags = struct.unpack(">H", data[pos + 8:pos + 10])[0]
            frame_data = data[pos + 10:pos + 10 + frame_size]

            if frame_id in FRAME_MAP:
                key = FRAME_MAP[frame_id]
                if key == "cover":
                    # APIC frame: encoding(1) + mime(null-term) + pic_type(1) + desc(null-term) + data
                    try:
                        mime_end = frame_data.find(b"\x00", 1)
                        mime = frame_data[1:mime_end].decode("ascii", errors="replace") if mime_end > 1 else "image/jpeg"
                        # Skip past description null terminator
                        desc_start = mime_end + 2  # +1 for null, +1 for pic_type byte
                        desc_end = frame_data.find(b"\x00", desc_start)
                        img_start = (desc_end + 1) if desc_end > desc_start else (mime_end + 2)
                        img_data = frame_data[img_start:]
                        if len(img_data) > 512:
                            result["cover_data"] = img_data
                            result["cover_mime"] = mime
                    except Exception:
                        pass
                else:
                    # Text frame: encoding(1) + text
                    try:
                        text = _decode_id3_lyrics_frame(frame_data) if key == "lyrics" else _decode_id3_text_frame(frame_data)
                        if text and not result.get(key):
                            result[key] = text
                    except Exception:
                        pass

            pos += 10 + frame_size

    except Exception:
        pass

    return result


def _decode_id3_text_frame(frame_data: bytes) -> str:
    if not frame_data:
        return ""
    enc = frame_data[0]
    text_bytes = frame_data[1:]
    if enc == 1:
        return text_bytes.decode("utf-16", errors="replace").strip("\x00")
    if enc == 2:
        return text_bytes.decode("utf-16-be", errors="replace").strip("\x00")
    if enc == 3:
        return text_bytes.decode("utf-8", errors="replace").strip("\x00")
    return text_bytes.decode("latin-1", errors="replace").strip("\x00")


def _decode_id3_lyrics_frame(frame_data: bytes) -> str:
    if len(frame_data) < 5:
        return ""
    enc = frame_data[0]
    payload = frame_data[4:]
    if enc in (1, 2):
        marker = payload.find(b"\x00\x00")
        if marker >= 0:
            payload = payload[marker + 2:]
    else:
        marker = payload.find(b"\x00")
        if marker >= 0:
            payload = payload[marker + 1:]
    return _decode_id3_text_frame(bytes([enc]) + payload).strip()


def _parse_flac_vorbis_comment(block: bytes) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    pos = 0
    try:
        vendor_len = int.from_bytes(block[pos:pos + 4], "little")
        pos += 4 + vendor_len
        count = int.from_bytes(block[pos:pos + 4], "little")
        pos += 4
        for _ in range(count):
            length = int.from_bytes(block[pos:pos + 4], "little")
            pos += 4
            raw = block[pos:pos + length].decode("utf-8", errors="replace")
            pos += length
            if "=" not in raw:
                continue
            key, value = raw.split("=", 1)
            key = key.strip().upper()
            value = value.strip()
            if key in {"TITLE", "ARTIST", "ALBUM"} and value:
                result.setdefault(key.lower(), value)
            if key in {"LYRICS", "UNSYNCEDLYRICS", "SYNCEDLYRICS"} and value:
                result.setdefault("lyrics", value)
    except Exception:
        pass
    return result


def _parse_flac_picture(block: bytes) -> Dict[str, Any] | None:
    try:
        pos = 4
        mime_len = int.from_bytes(block[pos:pos + 4], "big")
        pos += 4
        mime = block[pos:pos + mime_len].decode("ascii", errors="replace") or "image/jpeg"
        pos += mime_len
        desc_len = int.from_bytes(block[pos:pos + 4], "big")
        pos += 4 + desc_len
        pos += 16
        data_len = int.from_bytes(block[pos:pos + 4], "big")
        pos += 4
        image = block[pos:pos + data_len]
        if len(image) > 512:
            return {"cover_data": image, "cover_mime": mime}
    except Exception:
        pass
    return None


def _read_flac_metadata(data: bytes) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    if len(data) < 8 or data[:4] != b"fLaC":
        return result

    pos = 4
    try:
        while pos + 4 <= len(data):
            header = data[pos]
            block_type = header & 0x7F
            is_last = bool(header & 0x80)
            length = int.from_bytes(data[pos + 1:pos + 4], "big")
            pos += 4
            block = data[pos:pos + length]
            pos += length

            if block_type == 4:
                result.update(_parse_flac_vorbis_comment(block))
            elif block_type == 6 and not result.get("cover_data"):
                picture = _parse_flac_picture(block)
                if picture:
                    result.update(picture)

            if is_last:
                break
    except Exception:
        pass
    return result


def parse_audio_metadata(file_data: bytes, filename: str) -> Dict[str, Any]:
    """Extract title, artist, album, and cover art from an audio file.
    Supports MP3 ID3v2 and FLAC metadata. Falls back to filename heuristics.
    """
    tags = _read_id3v2(file_data) or _read_flac_metadata(file_data)

    # Fallback: guess from filename (e.g., "Artist - Title.mp3")
    name_no_ext = re.sub(r"\.[^.]+$", "", os.path.basename(filename))
    if not tags.get("title") or not tags.get("artist"):
        parts = re.split(r"\s*[-–—]\s*", name_no_ext, maxsplit=1)
        if len(parts) == 2:
            if not tags.get("artist"):
                tags["artist"] = parts[0].strip()
            if not tags.get("title"):
                tags["title"] = parts[1].strip()
        if not tags.get("title"):
            tags["title"] = name_no_ext.strip()

    if not tags.get("artist"):
        tags["artist"] = "Unknown Artist"

    return {
        "title": tags.get("title", name_no_ext),
        "artist": tags.get("artist", "Unknown Artist"),
        "album": tags.get("album", ""),
        "cover_data": tags.get("cover_data"),
        "cover_mime": tags.get("cover_mime", "image/jpeg"),
        "has_embedded_cover": bool(tags.get("cover_data")),
        "lyrics": tags.get("lyrics", ""),
    }


def get_headers(extra_cookie: str = ""):
    headers = dict(NETEASE_HEADERS)
    cookie = (extra_cookie or get_saved_netease_cookie() or os.getenv(NETEASE_COOKIE_ENV_KEY) or "").strip()
    if cookie:
        headers["Cookie"] = cookie
    return headers


def get_env_targets():
    targets = [os.path.join(PROJECT_ROOT, ".env.local")]
    sibling_blog = os.path.abspath(os.path.join(PROJECT_ROOT, "..", "blog"))
    if os.path.isdir(sibling_blog):
        targets.append(os.path.join(sibling_blog, ".env.local"))
    return list(dict.fromkeys(os.path.abspath(path) for path in targets))


def read_env_value(path: str, key: str):
    if not os.path.exists(path):
        return ""

    pattern = re.compile(rf"^\s*{re.escape(key)}\s*=\s*(.*)\s*$")
    with open(path, "r", encoding="utf-8") as file:
        for line in file:
            match = pattern.match(line)
            if not match:
                continue
            value = match.group(1).strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                value = value[1:-1]
            return value
    return ""


def write_env_value(path: str, key: str, value: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    safe_value = value.replace("\r", "").replace("\n", "").strip()
    pattern = re.compile(rf"^\s*{re.escape(key)}\s*=")
    lines = []

    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as file:
            lines = file.readlines()

    output = []
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

    with open(path, "w", encoding="utf-8") as file:
        file.writelines(output)


def get_saved_netease_cookie():
    for path in get_env_targets():
        value = read_env_value(path, NETEASE_COOKIE_ENV_KEY)
        if value:
            return value
    return ""


def save_netease_cookie(cookie: str):
    for path in get_env_targets():
        write_env_value(path, NETEASE_COOKIE_ENV_KEY, cookie)


def looks_like_netease_cookie(cookie: str):
    cookie = cookie.strip()
    return bool(cookie) and any(token in cookie for token in ("MUSIC_U=", "__csrf=", "NMTID=", "MUSIC_A="))


def mask_cookie(cookie: str):
    if not cookie:
        return ""

    music_u = re.search(r"MUSIC_U=([^;]+)", cookie)
    if music_u:
        value = music_u.group(1)
        if len(value) > 10:
            return f"MUSIC_U={value[:4]}...{value[-4:]}"
    return "已保存 Cookie"


def merge_cookie_headers(base_cookie: str, new_cookie: str):
    pairs: Dict[str, str] = {}
    for source in (base_cookie or "", new_cookie or ""):
        for part in source.split(";"):
            if "=" not in part:
                continue
            name, value = part.strip().split("=", 1)
            if name and value:
                pairs[name] = value
    return "; ".join(f"{name}={value}" for name, value in pairs.items())


def _cache_image(subdir: str, name: str, image_url: str) -> str | None:
    """Download an image and save it to every public/ target directory.
    Returns the public URL path on success, or None."""
    if not image_url or not image_url.startswith("http"):
        return None

    try:
        resp = requests.get(image_url, headers=NETEASE_HEADERS, timeout=(3, 10), stream=True)
        resp.raise_for_status()
        data = resp.content
        if len(data) < 512 or len(data) > 2 * 1024 * 1024:  # 2 MB sanity
            return None
    except Exception:
        return None

    # Determine extension from Content-Type, default to .jpg
    ct = (resp.headers.get("content-type") or "").lower()
    ext = ".jpg"
    for mime, suffix in (("image/png", ".png"), ("image/webp", ".webp"), ("image/jpeg", ".jpg"), ("image/gif", ".gif")):
        if mime in ct:
            ext = suffix
            break

    saved = False
    for root in (PROJECT_ROOT, BLOG_ROOT):
        if not os.path.isdir(root):
            continue
        try:
            target_dir = os.path.join(root, "public", "uploads", subdir)
            os.makedirs(target_dir, exist_ok=True)
            target = os.path.join(target_dir, f"{name}{ext}")
            with open(target, "wb") as f:
                f.write(data)
            saved = True
        except OSError:
            pass

    if saved:
        add_log("ops", f"[music] cover-cached: /uploads/{subdir}/{name}{ext} ({len(data)}B)")
    return f"/uploads/{subdir}/{name}{ext}" if saved else None


def request_json(url: str, cookie: str = "") -> Dict[str, Any]:
    response = NETEASE_SESSION.get(url, headers=get_headers(cookie), timeout=NETEASE_TIMEOUT)
    response.raise_for_status()
    response.encoding = response.apparent_encoding or "utf-8"
    return response.json()


def fetch_lyrics(song_id: str, cookie: str = ""):
    data = request_json(
        f"https://music.163.com/api/song/lyric?id={song_id}&lv=1&kv=1&tv=-1",
        cookie,
    )
    lyric = ((data.get("lrc") or {}).get("lyric") or "").strip()
    translated = ((data.get("tlyric") or {}).get("lyric") or "").strip()
    karaoke = ((data.get("klyric") or {}).get("lyric") or "").strip()
    return {
        "lyric": lyric or karaoke,
        "lrc": lyric or karaoke,
        "tlyric": translated,
        "translatedLyric": translated,
        "klyric": karaoke,
    }


def build_music_payload(song_id: str, cookie: str = "", include_lyrics: bool = True):
    local_song = get_local_music_manifest_song(song_id)
    if local_song:
        return local_song

    song = fetch_song_detail(song_id, cookie)
    if not song:
        return None

    lyrics = {"lyric": "", "lrc": "", "translatedLyric": "", "klyric": ""}
    if include_lyrics:
        try:
            lyrics = fetch_lyrics(song_id, cookie)
        except Exception:
            pass

    return {
        **song,
        "title": song.get("name") or f"网易云歌曲 {song_id}",
        "author": song.get("artist") or "",
        "pic": song.get("cover") or "",
        "src": f"https://music.163.com/song/media/outer/url?id={song_id}.mp3",
        "source": "netease-backend",
        **lyrics,
    }


def fallback_song_detail(song_id: str):
    return {
        "id": str(song_id),
        "name": f"NetEase Song {song_id}",
        "artist": "Unknown Artist",
        "album": "",
        "cover": LOCAL_DEFAULT_COVER,
        "fallback": True,
    }


def _cover_targets(song_id: str) -> list[str]:
    """Return local paths where a song cover may be stored."""
    ext = ".jpg"
    targets = []
    for root in (PROJECT_ROOT, BLOG_ROOT):
        if os.path.isdir(root):
            targets.append(os.path.join(root, "public", COVER_DIR, f"{song_id}{ext}"))
    # Deduplicate while preserving order
    return list(dict.fromkeys(os.path.abspath(p) for p in targets))


def _find_cached_cover(song_id: str) -> str | None:
    for path in _cover_targets(song_id):
        if os.path.exists(path) and os.path.getsize(path) > 1024:
            # Refresh mtime so we can age-out stale covers
            try:
                os.utime(path, None)
            except OSError:
                pass
            return f"/{COVER_DIR}/{song_id}.jpg"
    return None


def _cache_cover(song_id: str, cover_url: str) -> str | None:
    """Download a NetEase cover and save it to every public/ cover directory.
    Returns the public URL path on success, or None."""
    if not cover_url or not cover_url.startswith("http"):
        return None

    try:
        resp = requests.get(cover_url, headers=NETEASE_HEADERS, timeout=(3, 8), stream=True)
        resp.raise_for_status()
        data = resp.content
        if len(data) < 1024 or len(data) > 2 * 1024 * 1024:  # 2 MB sanity
            return None
    except Exception:
        return None

    saved = False
    for target in _cover_targets(song_id):
        try:
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, "wb") as f:
                f.write(data)
            saved = True
        except OSError:
            pass

    return f"/{COVER_DIR}/{song_id}.jpg" if saved else None


def resolve_cover(song_id: str, song: Dict[str, Any]) -> str:
    """Return the best available cover path for a song.
    Priority: local cache > NetEase download > default SVG."""
    cached = _find_cached_cover(song_id)
    if cached:
        return cached

    # Try to extract a real cover URL from the song data
    album = song.get("album") or song.get("al") or {}
    cover_url = album.get("picUrl") or album.get("blurPicUrl") or ""

    if cover_url:
        local = _cache_cover(song_id, cover_url)
        if local:
            return local

    return LOCAL_DEFAULT_COVER


def normalize_song(song: Dict[str, Any]) -> Dict[str, Any] | None:
    if not song:
        return None

    song_id = song.get("id")
    if not song_id:
        return None

    artists = song.get("artists") or song.get("ar") or []
    album = song.get("album") or song.get("al") or {}
    artist_name = " / ".join([item.get("name", "") for item in artists if item.get("name")]) or "Unknown Artist"

    return {
        "id": str(song_id),
        "name": song.get("name") or f"NetEase Song {song_id}",
        "artist": artist_name,
        "album": album.get("name") or "",
        "cover": resolve_cover(str(song_id), song),
        "duration": (song.get("dt") or song.get("duration") or 0) / 1000,
    }


def fetch_song_detail(song_id: str, cookie: str = ""):
    local_song = get_local_music_manifest_song(song_id)
    if local_song:
        return local_song

    c_payload = quote(f'[{{"id":{song_id}}}]', safe="")
    endpoints = [
        f"https://music.163.com/api/v3/song/detail?c={c_payload}",
        f"https://music.163.com/api/song/detail/?ids=[{song_id}]",
        f"https://music.163.com/api/song/detail/?id={song_id}&ids=[{song_id}]",
    ]

    for url in endpoints:
        try:
            data = request_json(url, cookie)
            songs = data.get("songs") or []
            if songs:
                normalized = normalize_song(songs[0])
                if normalized:
                    return normalized
        except Exception:
            continue

    return fallback_song_detail(song_id)


def fetch_song_details(song_ids: List[str], cookie: str = "") -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    seen = set()

    for start in range(0, len(song_ids), 50):
        chunk = song_ids[start:start + 50]
        c_payload = "[" + ",".join([f'{{"id":{song_id}}}' for song_id in chunk]) + "]"
        ids_payload = "[" + ",".join(chunk) + "]"
        endpoints = [
            f"https://music.163.com/api/v3/song/detail?c={quote(c_payload, safe='')}",
            f"https://music.163.com/api/song/detail/?ids={ids_payload}",
        ]

        for url in endpoints:
            try:
                data = request_json(url, cookie)
                for song in data.get("songs") or []:
                    normalized = normalize_song(song)
                    if normalized and normalized["id"] not in seen:
                        seen.add(normalized["id"])
                        result.append(normalized)
            except Exception:
                continue

    for song_id in song_ids:
        if song_id not in seen:
            result.append(fallback_song_detail(song_id))

    return result


def cookies_to_header(response: requests.Response, payload: Dict[str, Any]):
    payload_cookie = payload.get("cookie")
    if payload_cookie:
        return str(payload_cookie).replace(" HTTPOnly", "").strip()

    pairs = []
    for cookie in response.cookies:
        pairs.append(f"{cookie.name}={cookie.value}")
    return "; ".join(pairs)


def validate_cookie_profile(cookie: str):
    if not cookie:
        return None
    try:
        return fetch_account_profile(cookie)
    except Exception:
        return None


@router.get("/login/status")
def netease_login_status():
    cookie = get_saved_netease_cookie()
    if not cookie:
        return {
            "success": True,
            "loggedIn": False,
            "cookieSaved": False,
            "message": "尚未保存网易云登录 Cookie。",
            "targets": get_env_targets(),
        }

    try:
        profile = fetch_account_profile(cookie)
        if profile:
            return {
                "success": True,
                "loggedIn": True,
                "cookieSaved": True,
                "profile": profile,
                "maskedCookie": mask_cookie(cookie),
                "message": f"已登录网易云：{profile.get('nickname') or profile.get('userId')}",
                "targets": get_env_targets(),
            }

        return {
            "success": True,
            "loggedIn": False,
            "cookieSaved": True,
            "maskedCookie": mask_cookie(cookie),
            "message": "本地 Cookie 已保存，但网易云没有返回有效账号信息，可能已过期。",
            "targets": get_env_targets(),
        }
    except Exception as exc:
        return {
            "success": True,
            "loggedIn": False,
            "cookieSaved": True,
            "maskedCookie": mask_cookie(cookie),
            "verificationFailed": True,
            "message": f"本地 Cookie 已保存，但暂时无法验证：{exc}",
            "targets": get_env_targets(),
        }


@router.post("/login/clear")
def clear_netease_login():
    for path in get_env_targets():
        write_env_value(path, NETEASE_COOKIE_ENV_KEY, "")
    return {"success": True, "message": "已清除本地网易云登录状态。"}


@router.post("/login/cookie")
def save_cookie_login(payload: Dict[str, Any] = Body(...)):
    _op_log("netease-login", "cookie attempt")
    cookie = str(payload.get("cookie", "")).strip()
    if not cookie:
        return {"success": False, "message": "Cookie 不能为空。"}
    if "\n" in cookie or "\r" in cookie:
        return {"success": False, "message": "Cookie 不能包含换行。"}
    if not looks_like_netease_cookie(cookie):
        return {"success": False, "message": "这不像网易云 Cookie，请从 music.163.com 页面复制。"}

    try:
        profile = fetch_account_profile(cookie)
        if not profile:
            return {"success": False, "loggedIn": False, "message": "Cookie 无法验证账号信息，可能不完整或已过期。"}

        save_netease_cookie(cookie)
        return {
            "success": True,
            "loggedIn": True,
            "profile": profile,
            "maskedCookie": mask_cookie(cookie),
            "targets": get_env_targets(),
            "message": f"Cookie 登录已保存：{profile.get('nickname') or profile.get('userId')}",
        }
    except Exception as exc:
        return {"success": False, "loggedIn": False, "message": f"保存 Cookie 失败：{exc}"}


@router.post("/login/refresh")
def refresh_netease_login():
    cookie = get_saved_netease_cookie()
    if not cookie:
        return {"success": False, "loggedIn": False, "message": "本地还没有保存网易云 Cookie。"}

    try:
        response = NETEASE_SESSION.get(
            "https://music.163.com/api/login/token/refresh",
            headers=get_headers(cookie),
            timeout=NETEASE_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        refreshed_cookie = merge_cookie_headers(cookie, cookies_to_header(response, data))
        profile = validate_cookie_profile(refreshed_cookie)

        if not profile:
            return {
                "success": False,
                "loggedIn": False,
                "maskedCookie": mask_cookie(cookie),
                "message": "刷新请求完成，但 Cookie 无法验证账号，建议重新复制网页 Cookie。",
            }

        save_netease_cookie(refreshed_cookie)
        return {
            "success": True,
            "loggedIn": True,
            "profile": profile,
            "maskedCookie": mask_cookie(refreshed_cookie),
            "message": f"登录状态已刷新：{profile.get('nickname') or profile.get('userId')}",
        }
    except Exception as exc:
        return {"success": False, "loggedIn": False, "message": f"刷新登录状态失败：{exc}"}


@router.get("/login/qr/create")
def create_netease_qr_login():
    try:
        timestamp = int(time.time() * 1000)
        key_data = request_json(f"https://music.163.com/api/login/qrcode/unikey?type=1&timestamp={timestamp}", "")
        key = key_data.get("unikey") or (key_data.get("data") or {}).get("unikey")
        if not key:
            return {"success": False, "message": "未能获取二维码 key。"}

        qr_url = f"https://music.163.com/login?codekey={key}"
        qr_img = ""
        try:
            create_data = request_json(
                f"https://music.163.com/api/login/qrcode/create?key={key}&qrimg=true&timestamp={timestamp}",
                "",
            )
            qr_img = create_data.get("qrimg") or (create_data.get("data") or {}).get("qrimg") or ""
        except Exception:
            qr_img = ""

        qr_img = qr_img if str(qr_img).startswith("data:image") else ""

        return {
            "success": True,
            "key": key,
            "qrUrl": qr_url,
            "qrImg": qr_img,
            "message": "二维码已生成，请使用网易云音乐 App 扫码确认。",
        }
    except Exception as exc:
        return {"success": False, "message": f"生成二维码失败：{exc}"}


@router.get("/login/qr/check/{key}")
def check_netease_qr_login(key: str):
    if not key:
        return {"success": False, "message": "二维码 key 为空。"}

    try:
        timestamp = int(time.time() * 1000)
        url = f"https://music.163.com/api/login/qrcode/client/login?key={key}&type=1&timestamp={timestamp}"
        response = NETEASE_SESSION.get(url, headers=get_headers(""), timeout=NETEASE_TIMEOUT)
        response.raise_for_status()
        data = response.json()
        code = int(data.get("code", 0) or 0)

        messages = {
            800: "二维码已过期，请重新生成。",
            801: "等待扫码。",
            802: "已扫码，请在手机上确认登录。",
            803: "扫码已确认，正在验证账号。",
        }

        result = {
            "success": True,
            "code": code,
            "message": data.get("message") or messages.get(code, "正在检查扫码状态。"),
            "loggedIn": False,
        }

        if code == 803:
            cookie = cookies_to_header(response, data)
            if not cookie:
                result["success"] = False
                result["message"] = "扫码已确认，但网易云没有返回 Cookie。建议使用 Cookie 登录，更稳定。"
                return result

            saved_cookie = merge_cookie_headers(get_saved_netease_cookie(), cookie)
            profile = validate_cookie_profile(saved_cookie)
            if not profile:
                result["success"] = False
                result["message"] = "扫码已确认，但返回的 Cookie 无法验证账号。建议改用网页 Cookie 登录。"
                return result

            save_netease_cookie(saved_cookie)
            result.update({
                "loggedIn": True,
                "profile": profile,
                "maskedCookie": mask_cookie(saved_cookie),
                "targets": get_env_targets(),
                "message": f"登录成功：{profile.get('nickname') or profile.get('userId')}",
            })

        return result
    except Exception as exc:
        return {"success": False, "message": f"检查扫码状态失败：{exc}"}


@router.get("/query/{song_id}")
def query_netease_music(song_id: str):
    if not song_id.isdigit():
        return {"success": False, "message": "歌曲 ID 只能包含数字。"}

    try:
        song = fetch_song_detail(song_id)
        if song:
            return {"success": True, "data": song}
        return {"success": False, "message": "未找到该歌曲，可能是 ID 错误或歌曲受限。"}
    except Exception as exc:
        return {"success": False, "message": f"网易云请求失败：{exc}"}


@router.get("/lyrics/{song_id}")
def get_song_lyrics(song_id: str):
    if not song_id.isdigit():
        return {"success": False, "message": "歌曲 ID 只能包含数字。"}

    try:
        return {"success": True, "data": fetch_lyrics(song_id)}
    except Exception as exc:
        return {"success": False, "message": f"歌词读取失败：{exc}"}


@router.get("/detail/{song_id}")
def get_song_detail_with_lyrics(song_id: str):
    if not song_id.isdigit():
        return {"success": False, "message": "歌曲 ID 只能包含数字。"}

    try:
        song = build_music_payload(song_id, include_lyrics=True)
        if song:
            return {"success": True, "data": song}
        return {"success": False, "message": "未找到该歌曲。"}
    except Exception as exc:
        return {"success": False, "message": f"歌曲详情读取失败：{exc}"}


@router.get("/song/url/{song_id}")
def get_song_url(song_id: str, br: int = 320000):
    """获取直链播放 URL（类似 YesPlayMusic /song/url），带 Cookie 可拿全曲"""
    if not song_id.isdigit():
        return {"success": False, "message": "歌曲 ID 只能包含数字。"}

    cookie = get_saved_netease_cookie()
    url = f"https://music.163.com/api/song/enhance/player/url?id={song_id}&ids=[{song_id}]&br={br}"

    try:
        data = request_json(url, cookie)
        song_data = (data.get("data") or [{}])[0] if isinstance(data.get("data"), list) else data.get("data") or {}
        song_url = song_data.get("url") or ""

        if song_url:
            return {
                "success": True,
                "data": {
                    "id": song_id,
                    "url": song_url,
                    "br": song_data.get("br") or br,
                    "type": song_data.get("type") or "mp3",
                    "freeTrialInfo": song_data.get("freeTrialInfo"),
                },
            }
        # 无 Cookie 回退 outer url
        return {
            "success": True,
            "data": {
                "id": song_id,
                "url": f"https://music.163.com/song/media/outer/url?id={song_id}.mp3",
                "br": 128000,
                "type": "mp3",
                "fallback": True,
                "message": "未登录，返回试听链接",
            },
        }
    except Exception as exc:
        return {"success": False, "message": f"获取歌曲 URL 失败：{exc}"}


@router.get("/batch")
def get_song_batch(ids: str = Query(default="", description="Comma separated NetEase song ids")):
    song_ids = [item.strip() for item in ids.split(",") if item.strip().isdigit()][:30]

    if not song_ids:
        return {"success": False, "songs": [], "failedIds": [], "message": "请提供歌曲 ID。"}

    songs_by_id = {}
    failed_ids = []

    def fetch_one(song_id: str):
        try:
            song = build_music_payload(song_id, include_lyrics=True)
            return song_id, song
        except Exception:
            return song_id, None

    with ThreadPoolExecutor(max_workers=min(6, len(song_ids))) as executor:
        futures = [executor.submit(fetch_one, song_id) for song_id in song_ids]
        for future in as_completed(futures):
            song_id, song = future.result()
            if song:
                songs_by_id[song_id] = song
            else:
                failed_ids.append(song_id)

    songs = [songs_by_id[song_id] for song_id in song_ids if song_id in songs_by_id]
    for song_id in song_ids:
        if song_id not in songs_by_id and song_id not in failed_ids:
            failed_ids.append(song_id)

    return {
        "success": bool(songs),
        "songs": songs,
        "failedIds": failed_ids,
        "loggedIn": bool(get_saved_netease_cookie()),
        "message": f"已读取 {len(songs)} 首歌曲。",
    }


AUDIO_EXTENSIONS = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/flac": ".flac",
    "audio/x-flac": ".flac",
    "application/flac": ".flac",
}
ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac"}
MAX_LOCAL_AUDIO_SIZE = 30 * 1024 * 1024
MIN_LOCAL_AUDIO_SIZE = 8 * 1024  # 8 KB — accept short preview clips too
LOCAL_MUSIC_MANIFEST = "local_music.json"
def audio_upload_targets():
    blog_root = os.path.abspath(os.path.join(PROJECT_ROOT, "..", "blog"))
    return [
        os.path.join(PROJECT_ROOT, "public", "uploads", "music"),
        os.path.join(blog_root, "public", "uploads", "music"),
    ]


def public_roots():
    return [root for root in (PROJECT_ROOT, BLOG_ROOT) if os.path.isdir(root)]


def local_music_manifest_targets():
    return [
        os.path.join(root, "public", "uploads", "music", LOCAL_MUSIC_MANIFEST)
        for root in public_roots()
    ]


def load_local_music_manifest() -> Dict[str, Any]:
    for target in local_music_manifest_targets():
        try:
            if os.path.exists(target):
                with open(target, "r", encoding="utf-8") as file:
                    data = json.load(file)
                return data if isinstance(data, dict) else {}
        except Exception:
            continue
    return {}


def save_local_music_manifest(manifest: Dict[str, Any]) -> None:
    for target in local_music_manifest_targets():
        os.makedirs(os.path.dirname(target), exist_ok=True)
        tmp = f"{target}.tmp"
        with open(tmp, "w", encoding="utf-8") as file:
            json.dump(manifest, file, ensure_ascii=False, indent=2)
        os.replace(tmp, target)


def update_local_music_manifest(song: Dict[str, Any]) -> None:
    song_id = str(song.get("id") or "").strip()
    if not song_id:
        return
    manifest = load_local_music_manifest()
    manifest[song_id] = song
    save_local_music_manifest(manifest)


def get_local_music_manifest_song(song_id: str) -> Dict[str, Any] | None:
    item = load_local_music_manifest().get(str(song_id))
    if not isinstance(item, dict) or not has_local_audio(str(song_id)):
        return None

    title = str(item.get("title") or item.get("name") or f"Local Song {song_id}")
    artist = str(item.get("artist") or item.get("author") or "Unknown Artist")
    cover = str(item.get("cover") or item.get("pic") or LOCAL_DEFAULT_COVER)
    ext = str(item.get("ext") or ".mp3")
    lyric = str(item.get("lrc") or item.get("lyric") or "")
    return {
        "id": str(song_id),
        "name": title,
        "title": title,
        "artist": artist,
        "author": artist,
        "album": item.get("album") or "",
        "cover": cover,
        "pic": cover,
        "src": item.get("src") or f"/uploads/music/{song_id}{ext}",
        "url": item.get("url") or f"/uploads/music/{song_id}{ext}",
        "lrc": lyric,
        "lyric": lyric,
        "tlyric": str(item.get("tlyric") or ""),
        "duration": item.get("duration") or 0,
        "source": "local-upload",
    }


def audio_extension(upload: UploadFile):
    content_type = (upload.content_type or "").lower()
    if content_type in AUDIO_EXTENSIONS:
        return AUDIO_EXTENSIONS[content_type]
    ext = os.path.splitext(upload.filename or "")[1].lower()
    return ext if ext in ALLOWED_AUDIO_EXTENSIONS else ""


def remove_audio_variants(directory: str, song_id: str):
    for ext in ALLOWED_AUDIO_EXTENSIONS:
        target = os.path.join(directory, f"{song_id}{ext}")
        if os.path.exists(target):
            os.remove(target)


def has_local_audio(song_id: str):
    for directory in audio_upload_targets():
        if find_local_audio_in_directory(directory, song_id):
            return True
    return False


def find_local_audio_in_directory(directory: str, song_id: str):
    for ext in sorted(ALLOWED_AUDIO_EXTENSIONS):
        target = os.path.join(directory, f"{song_id}{ext}")
        if os.path.exists(target) and os.path.getsize(target) >= MIN_LOCAL_AUDIO_SIZE:
            return target
    return ""


def has_complete_local_audio(song_id: str):
    targets = audio_upload_targets()
    return bool(targets) and all(find_local_audio_in_directory(directory, song_id) for directory in targets)


def local_audio_files(song_id: str):
    files = []
    for directory in audio_upload_targets():
        target = find_local_audio_in_directory(directory, song_id)
        if target:
            files.append({"path": target, "size": os.path.getsize(target)})
    return files


def copy_audio_to_missing_targets(song_id: str):
    existing_files = local_audio_files(song_id)
    if not existing_files:
        return []

    source = existing_files[0]["path"]
    source_ext = os.path.splitext(source)[1].lower() or ".mp3"
    copied = []
    for directory in audio_upload_targets():
        if find_local_audio_in_directory(directory, song_id):
            continue
        os.makedirs(directory, exist_ok=True)
        target = os.path.join(directory, f"{song_id}{source_ext}")
        shutil.copyfile(source, target)
        copied.append(target)
    return copied


def resolve_playable_url(song_id: str):
    cookie = get_saved_netease_cookie()
    try:
        data = request_json(
            f"https://music.163.com/api/song/enhance/player/url?id={song_id}&ids=[{song_id}]&br=320000",
            cookie,
        )
        song_data = (data.get("data") or [{}])[0] if isinstance(data.get("data"), list) else data.get("data") or {}
        url = song_data.get("url") or ""
        if url:
            return url
    except Exception:
        pass
    return f"https://music.163.com/song/media/outer/url?id={song_id}.mp3"


def _looks_like_audio(content_type: str, url: str, data: bytes) -> bool:
    """Heuristic to decide if a response is audio, even when NetEase sends a vague MIME."""
    ct = (content_type or "").lower()
    # Explicit audio or octet-stream
    if any(token in ct for token in ("audio", "octet-stream", "application/octet-stream", "binary")):
        return True
    # No content-type header at all, but URL ends with .mp3 → common with NetEase
    if not ct and url.endswith(".mp3"):
        return True
    # NetEase sometimes returns text/plain for audio redirects — trust size + magic bytes
    if len(data) >= MIN_LOCAL_AUDIO_SIZE:
        # Check for MP3 frame sync (0xFF 0xFB/0xFA/0xF3/0xF2) or ID3 tag
        if data[:3] == b"ID3" or (len(data) > 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0):
            return True
    return False


def cache_one_audio(song_id: str):
    with AUDIO_FILE_LOCK:
        if has_complete_local_audio(song_id):
            return {"id": song_id, "status": "exists"}
        repaired = copy_audio_to_missing_targets(song_id)
        if has_complete_local_audio(song_id):
            return {"id": song_id, "status": "cached", "repaired": True, "saved": repaired}

    url = resolve_playable_url(song_id)
    try:
        response = NETEASE_SESSION.get(
            url,
            headers=get_headers(),
            timeout=(5, 25),
            stream=True,
            allow_redirects=True,
        )
        response.raise_for_status()
        data = response.content
        content_type = (response.headers.get("content-type") or "").lower()

        if len(data) > MAX_LOCAL_AUDIO_SIZE:
            return {"id": song_id, "status": "failed", "message": "audio file too large"}
        if not _looks_like_audio(content_type, url, data):
            return {"id": song_id, "status": "failed", "message": f"not an audio response (type={content_type or 'none'}, size={len(data)})"}

        saved = []
        with AUDIO_FILE_LOCK:
            if has_complete_local_audio(song_id):
                return {"id": song_id, "status": "exists"}
            repaired = copy_audio_to_missing_targets(song_id)
            if has_complete_local_audio(song_id):
                return {"id": song_id, "status": "cached", "repaired": True, "saved": repaired}
            for directory in audio_upload_targets():
                os.makedirs(directory, exist_ok=True)
                target = os.path.join(directory, f"{song_id}.mp3")
                with open(target, "wb") as output:
                    output.write(data)
                saved.append(target)
        return {"id": song_id, "status": "cached", "saved": saved}
    except Exception as exc:
        return {"id": song_id, "status": "failed", "message": str(exc)}


@router.post("/local/cache")
def cache_local_audio(payload: Dict[str, Any] = Body(...)):
    ids_value = payload.get("ids", [])
    _op_log("cache", f"requested {len(ids_value) if isinstance(ids_value, list) else '?'} songs")
    if not isinstance(ids_value, list):
        ids_value = str(ids_value or "").split(",")
    song_ids = []
    for item in ids_value:
        song_id = str(item).strip()
        if song_id.isdigit() and song_id not in song_ids:
            song_ids.append(song_id)
        if len(song_ids) >= 50:
            break

    if not song_ids:
        return {"success": False, "message": "No valid song IDs to cache."}

    results = []
    with ThreadPoolExecutor(max_workers=min(5, len(song_ids))) as executor:
        futures = [executor.submit(cache_one_audio, song_id) for song_id in song_ids]
        for future in as_completed(futures):
            results.append(future.result())

    cached = sum(1 for item in results if item.get("status") == "cached")
    existing = sum(1 for item in results if item.get("status") == "exists")
    failed = sum(1 for item in results if item.get("status") == "failed")
    _op_log("cache", f"cached={cached} existing={existing} failed={failed}", failed == 0)
    return {
        "success": cached + existing > 0,
        "cached": cached,
        "existing": existing,
        "failed": failed,
        "results": results,
        "targets": audio_upload_targets(),
        "message": f"Cached {cached}, existing {existing}, failed {failed}.",
    }


@router.get("/local/cache/status")
def local_cache_status(ids: str = Query(default="", description="Comma separated NetEase song ids")):
    song_ids = []
    for item in str(ids or "").split(","):
        song_id = item.strip()
        if song_id.isdigit() and song_id not in song_ids:
            song_ids.append(song_id)
        if len(song_ids) >= 50:
            break

    items = []
    for song_id in song_ids:
        files = local_audio_files(song_id)
        complete = has_complete_local_audio(song_id)
        items.append({"id": song_id, "files": files, "complete": complete})

    existing = sum(1 for item in items if item["complete"])
    partial = sum(1 for item in items if item["files"] and not item["complete"])
    return {
        "success": True,
        "total": len(song_ids),
        "existing": existing,
        "partial": partial,
        "missing": max(0, len(song_ids) - existing),
        "items": items,
        "targets": audio_upload_targets(),
    }


def _generate_song_id(data: bytes) -> str:
    """Generate a short unique numeric song ID from file content hash."""
    digest = hashlib.sha256(data).hexdigest()
    # Take first 10 hex chars → convert to decimal → use last 10 digits
    return str(int(digest[:12], 16) % 10_000_000_000).zfill(10)


def _safe_sidecar_key(filename: str) -> str:
    return re.sub(r"\.[^.]+$", "", os.path.basename(filename or "")).strip().lower()


async def _read_upload_text(upload: UploadFile) -> str:
    data = await upload.read()
    for encoding in ("utf-8-sig", "utf-16", "gb18030"):
        try:
            return data.decode(encoding).strip()
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace").strip()


def _save_cover_from_embedded(song_id: str, cover_data: bytes, cover_mime: str) -> str | None:
    """Save an embedded cover image to the covers directory."""
    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    ext = ext_map.get(cover_mime, ".jpg")
    saved = False
    for root in (PROJECT_ROOT, BLOG_ROOT):
        if not os.path.isdir(root):
            continue
        try:
            target_dir = os.path.join(root, "public", "uploads", "covers")
            os.makedirs(target_dir, exist_ok=True)
            target = os.path.join(target_dir, f"{song_id}{ext}")
            with open(target, "wb") as f:
                f.write(cover_data)
            saved = True
        except OSError:
            pass
    return f"/uploads/covers/{song_id}{ext}" if saved else None


@router.post("/local/upload")
async def upload_local_audio(id: str = Form(""), file: UploadFile = File(...)):
    song_id = str(id or "").strip()
    _op_log("upload", f"file={file.filename} size={file.size or '?'}B id={song_id or 'auto'}")

    ext = audio_extension(file)
    if not ext:
        return {"success": False, "message": "仅支持 mp3、m4a、aac、ogg、wav、flac。"}

    data = await file.read()
    if not data or len(data) > MAX_LOCAL_AUDIO_SIZE:
        return {"success": False, "message": "音频文件需小于 30MB。"}

    # Parse metadata from the audio file
    meta = parse_audio_metadata(data, file.filename or "unknown.mp3")

    # Auto-generate ID if not provided
    if not song_id or not song_id.isdigit() or len(song_id) < 3:
        song_id = _generate_song_id(data)

    # Save embedded cover art if present
    cover_url = _find_cached_cover(song_id)
    if not cover_url and meta.get("cover_data"):
        cover_url = _save_cover_from_embedded(song_id, meta["cover_data"], meta["cover_mime"])
    if not cover_url:
        cover_url = LOCAL_DEFAULT_COVER

    saved = []
    warnings = []
    with AUDIO_FILE_LOCK:
        for directory in audio_upload_targets():
            os.makedirs(directory, exist_ok=True)
            remove_audio_variants(directory, song_id)
            target = os.path.join(directory, f"{song_id}{ext}")
            with open(target, "wb") as output:
                output.write(data)
            saved.append(target)

    preferred_ext = ext
    if ext == ".flac":
        message = "FLAC saved without conversion. Browsers that support FLAC will play the original file."
    else:
        message = "Local audio saved. The player will prefer this file."

    lyrics = str(meta.get("lyrics") or "").strip()
    song = {
        "id": song_id,
        "title": meta["title"],
        "name": meta["title"],
        "artist": meta["artist"],
        "author": meta["artist"],
        "album": meta.get("album", ""),
        "cover": cover_url,
        "pic": cover_url,
        "lrc": lyrics,
        "lyric": lyrics,
        "tlyric": "",
        "src": f"/uploads/music/{song_id}{preferred_ext}",
        "url": f"/uploads/music/{song_id}{preferred_ext}",
        "ext": preferred_ext,
        "source": "local-upload",
    }
    update_local_music_manifest(song)

    _op_log("upload", f"id={song_id} title={meta['title']} cover={'embedded' if meta.get('has_embedded_cover') else 'none'}", True)

    return {
        "success": True,
        "id": song_id,
        "title": meta["title"],
        "artist": meta["artist"],
        "album": meta.get("album", ""),
        "cover": cover_url,
        "hasEmbeddedCover": meta["has_embedded_cover"],
        "hasLyrics": bool(lyrics),
        "url": f"/uploads/music/{song_id}{preferred_ext}",
        "saved": saved,
        "converted": [],
        "warnings": warnings,
        "ext": preferred_ext,
        "song": song,
        "message": message,
    }


@router.post("/local/upload/batch")
async def upload_local_audio_batch(id: str = Form(""), files: List[UploadFile] = File(...)):
    if not files:
        return {"success": False, "message": "Choose at least one audio file."}

    sidecars: Dict[str, str] = {}
    audio_files: List[UploadFile] = []
    for upload in files:
        ext = os.path.splitext(upload.filename or "")[1].lower()
        if ext == ".lrc":
            sidecars[_safe_sidecar_key(upload.filename or "")] = await _read_upload_text(upload)
        else:
            audio_files.append(upload)

    if not audio_files:
        return {"success": False, "message": "Choose at least one audio file."}

    results = []
    for upload in audio_files:
        override_id = id if len(audio_files) == 1 else ""
        result = await upload_local_audio(override_id, upload)
        sidecar_lyrics = sidecars.get(_safe_sidecar_key(upload.filename or ""), "")
        if result.get("success") and sidecar_lyrics:
            song_id = str(result.get("id") or "")
            manifest = load_local_music_manifest()
            item = manifest.get(song_id)
            if isinstance(item, dict):
                item["lrc"] = sidecar_lyrics
                item["lyric"] = sidecar_lyrics
                item["hasLyrics"] = True
                save_local_music_manifest(manifest)
                result["hasLyrics"] = True
                result["song"] = {**(result.get("song") or {}), "lrc": sidecar_lyrics, "lyric": sidecar_lyrics}
        results.append(result)

    uploaded = [item for item in results if item.get("success")]
    failed = [item for item in results if not item.get("success")]
    _op_log("upload-batch", f"uploaded={len(uploaded)} failed={len(failed)}", len(failed) == 0)
    return {
        "success": len(uploaded) > 0,
        "items": uploaded,
        "failedItems": failed,
        "songIds": [item["id"] for item in uploaded],
        "message": f"Uploaded {len(uploaded)} local songs, failed {len(failed)}.",
    }


@router.post("/playlist/sync")
def sync_playlist(payload: Dict[str, Any] = Body(...)):
    playlist_id = str(payload.get("playlistId", "")).strip()
    _op_log("playlist-sync", f"id={playlist_id}")
    cookie = str(payload.get("cookie", "")).strip()
    limit = int(payload.get("limit", 50) or 50)
    limit = max(1, min(limit, 50))
    include_lyrics = bool(payload.get("includeLyrics", False))

    if not playlist_id.isdigit():
        return {"success": False, "message": "歌单 ID 只能包含数字。"}

    try:
        data = request_json(f"https://music.163.com/api/playlist/detail?id={playlist_id}", cookie)
        playlist = data.get("result") or data.get("playlist") or {}
        raw_tracks = playlist.get("tracks") or []
        track_ids = [str(item.get("id")) for item in (playlist.get("trackIds") or []) if item.get("id")]

        songs = [song for song in (normalize_song(item) for item in raw_tracks) if song]
        if len(songs) < min(limit, len(track_ids)):
            known_ids = {song["id"] for song in songs}
            missing_ids = [song_id for song_id in track_ids if song_id not in known_ids]
            songs.extend(fetch_song_details(missing_ids[:limit], cookie))

        songs = songs[:limit]
        if include_lyrics:
            for song in songs[:30]:
                try:
                    song.update(fetch_lyrics(song["id"], cookie))
                except Exception:
                    pass

        song_ids = [song["id"] for song in songs]

        pl_cover = _find_cached_cover(f"playlist-{playlist_id}") or _cache_image("covers", f"playlist-{playlist_id}", playlist.get("coverImgUrl") or "") or LOCAL_DEFAULT_COVER

        _op_log("playlist-sync", f"id={playlist_id} name={playlist.get('name', '?')} songs={len(song_ids)}", True)

        return {
            "success": True,
            "playlist": {
                "id": playlist_id,
                "name": playlist.get("name") or f"歌单 {playlist_id}",
                "cover": pl_cover,
                "trackCount": playlist.get("trackCount") or len(song_ids),
            },
            "songIds": song_ids,
            "songs": songs,
            "message": f"已读取 {len(song_ids)} 首歌曲。",
        }
    except Exception as exc:
        return {"success": False, "message": f"歌单同步失败：{exc}"}


def fetch_user_playlists(user_id: str, limit: int = 50, cookie: str = ""):
    limit = max(1, min(int(limit or 50), 100))
    data = request_json(f"https://music.163.com/api/user/playlist/?offset=0&limit={limit}&uid={user_id}", cookie)
    playlists = []
    for item in data.get("playlist") or []:
        pl_id = str(item.get("id"))
        cover = _find_cached_cover(f"playlist-{pl_id}") or _cache_image("covers", f"playlist-{pl_id}", item.get("coverImgUrl") or "") or LOCAL_DEFAULT_COVER
        playlists.append({
            "id": pl_id,
            "name": item.get("name") or "",
            "cover": cover,
            "trackCount": item.get("trackCount") or 0,
            "creator": (item.get("creator") or {}).get("nickname") or "",
        })
    return playlists


def fetch_account_profile(cookie: str = ""):
    cookie = cookie or get_saved_netease_cookie()
    if not cookie:
        return None

    data = request_json("https://music.163.com/api/nuser/account/get", cookie)
    profile = data.get("profile") or {}
    account = data.get("account") or {}
    user_id = profile.get("userId") or account.get("userId") or account.get("id")
    if not user_id:
        return None

    nickname = (profile.get("nickname") or account.get("userName") or "").strip()
    avatar_url = profile.get("avatarUrl") or ""
    local_avatar = _cache_image("avatars", f"user-{user_id}", avatar_url) if avatar_url else None

    return {
        "userId": str(user_id),
        "nickname": nickname,
        "avatarUrl": local_avatar or LOCAL_DEFAULT_AVATAR,
    }


@router.get("/account")
def get_netease_account():
    try:
        profile = fetch_account_profile()
        if not profile:
            return {"success": False, "loggedIn": False, "message": "尚未登录网易云账号，或登录状态已失效。"}
        return {"success": True, "loggedIn": True, "profile": profile}
    except Exception as exc:
        return {"success": False, "loggedIn": False, "message": f"读取账号信息失败：{exc}"}


@router.get("/me/playlists")
def list_my_playlists(limit: int = 50):
    try:
        profile = fetch_account_profile()
        if not profile:
            return {"success": False, "loggedIn": False, "message": "请先登录网易云账号。"}

        playlists = fetch_user_playlists(profile["userId"], limit)
        return {"success": True, "loggedIn": True, "profile": profile, "playlists": playlists}
    except Exception as exc:
        return {"success": False, "message": f"读取当前账号歌单失败：{exc}"}


@router.get("/user/{user_id}/playlists")
def list_user_playlists(user_id: str, limit: int = 50):
    if not user_id.isdigit():
        return {"success": False, "message": "用户 ID 只能包含数字。"}

    try:
        playlists = fetch_user_playlists(user_id, limit)
        return {"success": True, "playlists": playlists}
    except Exception as exc:
        return {"success": False, "message": f"读取用户公开歌单失败：{exc}"}
