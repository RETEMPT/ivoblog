import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { siteConfig } from "../../../siteConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_FILE = path.join(process.cwd(), ".music-cache.json");
const CACHE_FRESH_AGE = 7 * 24 * 60 * 60 * 1000;
const CACHE_STALE_AGE = 30 * 24 * 60 * 60 * 1000;
const BACKEND_BATCH_SIZE = 30;
const MAX_PLAYLIST_SIZE = 50;
const DIRECT_NETEASE_LIMIT = 50;

type MusicSong = {
  id: string;
  title: string;
  artist: string;
  cover: string;
  src: string;
  lrc: string;
  lyric: string;
  tlyric: string;
  name: string;
  author: string;
  pic: string;
  source: string;
  duration: number;
};

type CachedMusicSong = MusicSong & { cachedAt: number };

function loadCache(): Map<string, CachedMusicSong> {
  try {
    if (!fs.existsSync(CACHE_FILE)) return new Map();
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    return new Map(Object.entries(raw)) as Map<string, CachedMusicSong>;
  } catch {
    return new Map();
  }
}

function saveCache(cache: Map<string, CachedMusicSong>) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache), null, 2), "utf-8");
  } catch { /* silent */ }
}

const REQUEST_TIMEOUT = 5000;
const BACKEND_TIMEOUT = 18000;
const MUSIC_BACKEND_BASE = (process.env.MUSIC_BACKEND_BASE || "http://127.0.0.1:52560").replace(/\/+$/, "");
const DEFAULT_COVER = "/uploads/images/music-default-cover.svg";
const LEGACY_DEFAULT_COVER = "/uploads/images/_20251225232527_213_2-0d4cd615c3.jpg";
const NETEASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  Referer: "https://music.163.com/",
};

export async function GET(request: NextRequest) {
  const ids = parseIds(request.nextUrl.searchParams.get("ids"));

  if (ids.length === 0) {
    return NextResponse.json({ success: false, songs: [], failedIds: [], message: "No music ids provided." });
  }

  // 1. 本地缓存命中
  const cache = loadCache();
  const now = Date.now();
  const freshCache = new Map<string, CachedMusicSong>();
  const staleCache = new Map<string, CachedMusicSong>();
  const missing: string[] = [];
  let fresh: MusicSong[] = [];

  for (const id of ids) {
    const entry = cache.get(id);
    const age = entry ? now - entry.cachedAt : Number.POSITIVE_INFINITY;

    if (entry && age < CACHE_FRESH_AGE && !isWeakFallback(entry) && hasRealCover(entry)) {
      freshCache.set(id, entry);
    } else if (entry && age < CACHE_STALE_AGE) {
      staleCache.set(id, entry);
      missing.push(id);
    } else {
      missing.push(id);
    }
  }

  // Refresh missing or stale songs from the backend first, then fallback to NetEase links.
  if (missing.length > 0) {
    const localSongs = resolveLocalManifestSongs(missing);
    const localIds = new Set(localSongs.map((song) => song.id));
    const backendSongs = await resolveBackendSongs(missing.filter((id) => !localIds.has(id)));
    const resolvedIds = new Set(backendSongs.map((s) => s.id));
    const stillMissing = missing.filter((id) => !localIds.has(id) && !resolvedIds.has(id));
    const directIds = stillMissing.slice(0, DIRECT_NETEASE_LIMIT);
    const fallbackIds = stillMissing.slice(DIRECT_NETEASE_LIMIT);
    const neteaseSongs = [
      ...((await Promise.all(directIds.map((id) => resolveSong(id)))).filter(Boolean) as MusicSong[]),
      ...fallbackIds.map((id) => fallbackSong(id)),
    ];
    fresh = [...localSongs, ...backendSongs, ...neteaseSongs];

    // 3. 鍐欏叆缂撳瓨
    for (const song of fresh) {
      const existing = cache.get(song.id);
      if (shouldUpdateCache(song, existing)) {
        cache.set(song.id, { ...song, cachedAt: now });
      }
    }
    if (fresh.length > 0) saveCache(cache);
  }

  const freshById = new Map(fresh.map((song) => [song.id, song]));
  const songs = ids
    .map((id) => pickSong(id, freshById, freshCache, staleCache))
    .filter(Boolean) as MusicSong[];
  const songsWithPlaybackUrls = songs.map((song) => sanitizeSongImages({ ...song, src: neteaseOuterUrl(song.id) }));
  const failedIds = ids.filter((id) => !songs.some((s) => s.id === id));

  return NextResponse.json(
    {
      success: songsWithPlaybackUrls.length > 0,
      songs: songsWithPlaybackUrls,
      failedIds,
      fromCache: songsWithPlaybackUrls.filter((song) => freshCache.has(song.id) || staleCache.has(song.id)).length,
      fromRemote: fresh.length,
      staleCache: songsWithPlaybackUrls.filter((song) => staleCache.has(song.id) && !freshById.has(song.id)).length,
      message: songsWithPlaybackUrls.length > 0 ? "Music loaded." : "Music providers are unavailable.",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}

function parseIds(raw: string | null) {
  return (raw || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^\d{3,}$/.test(id))
    .slice(0, MAX_PLAYLIST_SIZE);
}

async function resolveBackendSongs(ids: string[]): Promise<MusicSong[]> {
  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += BACKEND_BATCH_SIZE) {
    chunks.push(ids.slice(start, start + BACKEND_BATCH_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const url = `${MUSIC_BACKEND_BASE}/api/music/batch?ids=${encodeURIComponent(chunk.join(","))}`;
        const response = await fetchWithTimeout(url, { cache: "no-store" }, BACKEND_TIMEOUT);
        if (!response.ok) return [];

        const data = await response.json().catch(() => null);
        const chunkSongs = Array.isArray(data?.songs) ? data.songs : [];
        return chunkSongs.map(normalizeBackendSong).filter(Boolean) as MusicSong[];
      } catch {
        return [];
      }
    }),
  );

  return results.flat();
}

function normalizeBackendSong(song: any): MusicSong | null {
  const id = firstString(song?.id);
  if (!id) return null;

  const title = firstString(song?.title, song?.name, `Song ${id}`);
  const artist = firstString(song?.artist, song?.author, "Unknown Artist");
  const cover = localImage(firstString(song?.cover, song?.pic, DEFAULT_COVER));
  const lrc = firstString(song?.lrc, song?.lyric, song?.klyric, "");
  const tlyric = firstString(song?.tlyric, song?.translation, song?.translatedLyric, "");

  return {
    id,
    title,
    artist,
    cover,
    src: firstString(song?.src, neteaseOuterUrl(id)),
    lrc,
    lyric: lrc,
    tlyric,
    name: title,
    author: artist,
    pic: cover,
    source: firstString(song?.source, "netease-backend"),
    duration: typeof song?.duration === "number" ? song.duration : 0,
  };
}

async function resolveSong(id: string): Promise<MusicSong | null> {
  const neteaseSong = await resolveNeteaseSong(id);
  if (neteaseSong) return neteaseSong;
  return fallbackSong(id);
}

async function resolveNeteaseSong(id: string): Promise<MusicSong | null> {
  try {
    const detailUrl = `https://music.163.com/api/song/detail?ids=${encodeURIComponent(`[${id}]`)}`;
    const detail = await fetchJson(detailUrl, NETEASE_HEADERS);
    const song = Array.isArray(detail?.songs) ? detail.songs[0] : null;

    if (!song) return null;

    const lyricUrl = `https://music.163.com/api/song/lyric?id=${encodeURIComponent(id)}&lv=1&kv=1&tv=-1`;
    const lyric = await fetchJson(lyricUrl, NETEASE_HEADERS).catch(() => null);

    const title = firstString(song.name, `Song ${id}`);
    const artist = Array.isArray(song.artists)
      ? song.artists.map((artist: any) => artist?.name).filter(Boolean).join(" / ") || "Unknown Artist"
      : "Unknown Artist";
    const album = song.album || song.al || {};
    const cover = (await cacheRemoteCover(id, firstString(album.picUrl, album.blurPicUrl))) || DEFAULT_COVER;
    const lrc = firstString(lyric?.lrc?.lyric, lyric?.klyric?.lyric, "");
    const tlyric = firstString(lyric?.tlyric?.lyric, "");

    return {
      id,
      title,
      artist,
      cover,
      src: neteaseOuterUrl(id),
      lrc,
      lyric: lrc,
      tlyric,
      name: title,
      author: artist,
      pic: cover,
      source: "netease",
      duration: (song.dt || song.duration || 0) / 1000,
    };
  } catch {
    return null;
  }
}

async function cacheRemoteCover(id: string, coverUrl: string) {
  if (!coverUrl || !/^https?:\/\//i.test(coverUrl)) return "";

  const existing = findCachedCover(id);
  if (existing) return existing;

  try {
    const response = await fetchWithTimeout(coverUrl, { headers: NETEASE_HEADERS, cache: "no-store" }, REQUEST_TIMEOUT);
    if (!response.ok) return "";

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("image/")) return "";

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1024 || bytes.length > 2 * 1024 * 1024) return "";

    const ext = contentType.includes("png")
      ? ".png"
      : contentType.includes("webp")
        ? ".webp"
        : contentType.includes("gif")
          ? ".gif"
          : ".jpg";
    const publicPath = `/uploads/covers/${id}${ext}`;
    let saved = false;

    for (const root of publicRoots()) {
      try {
        const targetDir = path.join(root, "public", "uploads", "covers");
        fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, `${id}${ext}`), bytes);
        saved = true;
      } catch {
        // Cover cache is best-effort.
      }
    }

    return saved ? publicPath : "";
  } catch {
    return "";
  }
}

function findCachedCover(id: string) {
  for (const root of publicRoots()) {
    const coverDir = path.join(root, "public", "uploads", "covers");
    for (const ext of [".jpg", ".png", ".webp", ".gif"]) {
      const file = path.join(coverDir, `${id}${ext}`);
      try {
        if (fs.existsSync(file) && fs.statSync(file).size > 1024) return `/uploads/covers/${id}${ext}`;
      } catch {
        // Ignore unreadable cache entries.
      }
    }
  }
  return "";
}

function publicRoots() {
  const roots = [process.cwd()];
  const siblingBlog = path.resolve(process.cwd(), "..", "blog");
  const siblingManager = path.resolve(process.cwd(), "..", "my-blog-manager");
  for (const root of [siblingBlog, siblingManager]) {
    if (fs.existsSync(root) && !roots.includes(root)) roots.push(root);
  }
  return roots;
}

function resolveLocalManifestSongs(ids: string[]): MusicSong[] {
  const manifest = loadLocalMusicManifest();
  return ids
    .map((id) => normalizeLocalManifestSong(id, manifest[id]))
    .filter(Boolean) as MusicSong[];
}

function loadLocalMusicManifest(): Record<string, any> {
  for (const root of publicRoots()) {
    const target = path.join(root, "public", "uploads", "music", "local_music.json");
    try {
      if (fs.existsSync(target)) {
        const data = JSON.parse(fs.readFileSync(target, "utf-8"));
        if (data && typeof data === "object" && !Array.isArray(data)) return data;
      }
    } catch {
      // Ignore malformed local music manifests.
    }
  }
  return {};
}

function normalizeLocalManifestSong(id: string, item: any): MusicSong | null {
  if (!item || typeof item !== "object") return null;
  const localFile = findLocalAudioFile(id);
  if (!localFile) return null;

  const title = firstString(item.title, item.name, `Local Song ${id}`);
  const artist = firstString(item.artist, item.author, "Unknown Artist");
  const cover = localImage(firstString(item.cover, item.pic, DEFAULT_COVER));
  const lrc = firstString(item.lrc, item.lyric, "");
  return {
    id,
    title,
    artist,
    cover,
    src: neteaseOuterUrl(id),
    lrc,
    lyric: lrc,
    tlyric: firstString(item.tlyric, ""),
    name: title,
    author: artist,
    pic: cover,
    source: "local-upload",
    duration: typeof item.duration === "number" ? item.duration : 0,
  };
}

function findLocalAudioFile(id: string) {
  for (const root of publicRoots()) {
    const directory = path.join(root, "public", "uploads", "music");
    for (const ext of [".flac", ".mp3", ".m4a", ".aac", ".ogg", ".wav"]) {
      const file = path.join(directory, `${id}${ext}`);
      try {
        if (fs.existsSync(file) && fs.statSync(file).size > 8 * 1024) return file;
      } catch {
        // Ignore unreadable local files.
      }
    }
  }
  return "";
}

async function fetchJson(url: string, headers?: HeadersInit) {
  const response = await fetchWithTimeout(url, { headers, cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const text = await response.text();
  return JSON.parse(text);
}

function fallbackSong(id: string): MusicSong {
  const title = `网易云歌曲 ${id}`;
  const artist = "Unknown Artist";
  const cover = DEFAULT_COVER;
  const lrc = "";
  const tlyric = "";

  return {
    id,
    title,
    artist,
    cover,
    src: neteaseOuterUrl(id),
    lrc,
    lyric: lrc,
    tlyric,
    name: title,
    author: artist,
    pic: cover,
    source: "netease-fallback",
    duration: 0,
  };
}

function sanitizeSongImages(song: MusicSong): MusicSong {
  const cover = localImage(song.cover || song.pic || DEFAULT_COVER);
  return { ...song, cover, pic: cover };
}

function localImage(src: string) {
  if (!src.startsWith("/")) return DEFAULT_COVER;
  if (src === LEGACY_DEFAULT_COVER) return DEFAULT_COVER;
  return src;
}

function isWeakFallback(song: MusicSong) {
  const title = firstString(song.title, song.name);
  const artist = firstString(song.artist, song.author);
  return (
    song.source === "netease-fallback" ||
    title === `Song ${song.id}` ||
    (title.includes(song.id) && /^(NetEase Song|网易云歌曲|缂|缃|Song)/i.test(title)) ||
    artist === "Unknown Artist"
  );
}

function hasRealCover(song: MusicSong) {
  const cover = firstString(song.cover, song.pic);
  return Boolean(cover && cover !== DEFAULT_COVER && cover !== LEGACY_DEFAULT_COVER);
}

function hasUsefulMetadata(song?: CachedMusicSong) {
  if (!song) return false;
  return Boolean(
    song.title &&
    !isWeakFallback(song) &&
    ((song.cover && song.cover !== DEFAULT_COVER) || song.lrc || song.lyric || song.tlyric),
  );
}

function shouldUpdateCache(song: MusicSong, existing?: CachedMusicSong) {
  if (!isWeakFallback(song)) return true;
  return !hasUsefulMetadata(existing);
}

function pickSong(
  id: string,
  freshById: Map<string, MusicSong>,
  freshCache: Map<string, CachedMusicSong>,
  staleCache: Map<string, CachedMusicSong>,
) {
  const fresh = freshById.get(id);
  if (fresh && !isWeakFallback(fresh)) return fresh;
  const freshCached = freshCache.get(id);
  const staleCached = staleCache.get(id);
  if (freshCached && !isWeakFallback(freshCached)) return freshCached;
  if (staleCached && !isWeakFallback(staleCached)) return staleCached;
  return fresh || freshCached || staleCached;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function neteaseOuterUrl(id: string) {
  const mode = (siteConfig as any).musicPlaybackMode === "local" ? "local" : "cloud";
  return `/api/music/proxy/${encodeURIComponent(id)}?mode=${mode}`;
}
