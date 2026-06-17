import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MUSIC_BACKEND_BASE = (process.env.MUSIC_BACKEND_BASE || "http://127.0.0.1:52560").replace(/\/+$/, "");
const CACHE_SUBDIR = path.join("public", "uploads", "music");
const AUDIO_EXTENSIONS = [".flac", ".mp3", ".m4a", ".aac", ".ogg", ".wav"];
const MIN_AUDIO_BYTES = 8 * 1024;  // 8 KB — accept short preview clips too

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  Referer: "https://music.163.com/",
};

function looksLikeAudio(contentType: string, url: string, bytes: Buffer): boolean {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("audio") || ct.includes("octet-stream") || ct.includes("binary")) return true;
  if (!ct && url.endsWith(".mp3")) return true;
  // NetEase sometimes returns text/plain — trust MP3 magic bytes
  if (bytes.length >= 4) {
    if (bytes.subarray(0, 3).toString() === "ID3") return true;
    if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return true;
  }
  return false;
}

function publicRoots() {
  const roots = [
    process.cwd(),
    path.resolve(process.cwd(), "..", "blog"),
    path.resolve(process.cwd(), "..", "my-blog-manager"),
  ];
  return [...new Set(roots)].filter((root) => root === process.cwd() || fs.existsSync(root));
}

function cacheDirs() {
  return publicRoots().map((root) => path.join(root, CACHE_SUBDIR));
}

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".m4a" || ext === ".aac") return "audio/mp4";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".flac") return "audio/flac";
  return "audio/mpeg";
}

function findLocalAudio(id: string) {
  for (const directory of cacheDirs()) {
    for (const ext of AUDIO_EXTENSIONS) {
      const filePath = path.join(directory, `${id}${ext}`);
      if (fs.existsSync(filePath) && fs.statSync(filePath).size >= MIN_AUDIO_BYTES) return filePath;
    }
  }
  return null;
}

function localAudioResponse(filePath: string, rangeHeader: string | null) {
  const stat = fs.statSync(filePath);
  const headers = {
    "Content-Type": contentTypeFor(filePath),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  if (!rangeHeader) {
    return new Response(fs.readFileSync(filePath), {
      status: 200,
      headers: { ...headers, "Content-Length": String(stat.size) },
    });
  }

  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  const start = match?.[1] ? Number(match[1]) : 0;
  const end = match?.[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
  if (!match || start >= stat.size || end < start) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${stat.size}` },
    });
  }

  const chunk = fs.readFileSync(filePath).subarray(start, end + 1);
  return new Response(chunk, {
    status: 206,
    headers: {
      ...headers,
      "Content-Length": String(chunk.length),
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
    },
  });
}

async function getBestUrl(id: string): Promise<string> {
  try {
    const backend = await fetch(`${MUSIC_BACKEND_BASE}/api/music/song/url/${id}?br=320000`, {
      signal: AbortSignal.timeout(4500),
      cache: "no-store",
    });
    if (backend.ok) {
      const data = await backend.json().catch(() => null);
      if (data?.data?.url && !data.data.fallback) return data.data.url;
    }
  } catch {
    // The local music backend is optional.
  }

  return `https://music.163.com/song/media/outer/url?id=${encodeURIComponent(id)}.mp3`;
}

async function fetchAndCacheRemoteAudio(id: string) {
  const url = await getBestUrl(id);
  const response = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(120000),
    redirect: "follow",
  });
  if (!response.ok) return null;

  const contentType = response.headers.get("Content-Type") || "";
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < MIN_AUDIO_BYTES || !looksLikeAudio(contentType, url, bytes)) return null;

  for (const directory of cacheDirs()) {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, `${id}.mp3`), bytes);
  }
  return { bytes, contentType: contentType.includes("audio") ? contentType : "audio/mpeg" };
}

async function streamRemoteAudio(id: string, rangeHeader: string | null) {
  const url = await getBestUrl(id);
  const response = await fetch(url, {
    headers: rangeHeader ? { ...HEADERS, Range: rangeHeader } : HEADERS,
    signal: AbortSignal.timeout(600000),
    redirect: "follow",
  });
  if (!response.ok || !response.body) return null;

  const contentType = response.headers.get("Content-Type") || "";
  // For streaming we can't check magic bytes, so rely on content-type or URL
  if (!looksLikeAudio(contentType, url, Buffer.alloc(0))) return null;

  const headers = new Headers({
    "Content-Type": contentType.includes("audio") ? contentType : "audio/mpeg",
    "Cache-Control": "no-store",
    "Accept-Ranges": response.headers.get("Accept-Ranges") || "bytes",
  });
  const contentLength = response.headers.get("Content-Length");
  const contentRange = response.headers.get("Content-Range");
  if (contentLength) headers.set("Content-Length", contentLength);
  if (contentRange) headers.set("Content-Range", contentRange);

  return new Response(response.body, { status: response.status === 206 ? 206 : 200, headers });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response(null, { status: 400 });

  try {
    const mode = new URL(request.url).searchParams.get("mode") === "local" ? "local" : "cloud";
    const localFile = findLocalAudio(id);
    if (localFile) return localAudioResponse(localFile, request.headers.get("range"));

    if (mode === "cloud") {
      const streamed = await streamRemoteAudio(id, request.headers.get("range"));
      if (streamed) return streamed;
      return new Response(null, { status: 404 });
    }

    const cached = await fetchAndCacheRemoteAudio(id);
    if (!cached) return new Response(null, { status: 404 });

    return new Response(cached.bytes, {
      status: 200,
      headers: {
        "Content-Type": cached.contentType,
        "Content-Length": String(cached.bytes.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
