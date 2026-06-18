"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { siteConfig } from "../siteConfig";

type PlayMode = "loop" | "single" | "random";

type LyricLine = {
  time: number;
  text: string;
};

type MusicSong = {
  id: string;
  title: string;
  artist: string;
  cover: string;
  src: string;
  lrc?: string;
  lyric?: string;
  tlyric?: string;
  lyrics?: LyricLine[] | string;
  name?: string;
  author?: string;
  pic?: string;
  source?: string;
  duration?: number;
};

interface MusicContextType {
  playlist: MusicSong[];
  currentIndex: number;
  currentSong: MusicSong | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  currentLyric: string;
  isLoading: boolean;
  volume: number;
  isMuted: boolean;
  playMode: PlayMode;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  playSong: (index: number) => void;
  selectSong: (index: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  togglePlayMode: () => void;
}

const MusicContext = createContext<MusicContextType | null>(null);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const DEFAULT_MUSIC_COVER = "/uploads/images/music-default-cover.svg";
const LEGACY_DEFAULT_COVER = "/uploads/images/_20251225232527_213_2-0d4cd615c3.jpg";

function normalizeMusicCover(value?: string) {
  const src = (value || "").trim();
  if (!src.startsWith("/")) return DEFAULT_MUSIC_COVER;
  // Migrate any lingering reference to the old default cover
  if (src === LEGACY_DEFAULT_COVER) return DEFAULT_MUSIC_COVER;
  return src;
}

function collectLrcLines(lrcText: string): LyricLine[] {
  if (!lrcText || lrcText.length > 30000) return [];

  const result: LyricLine[] = [];

  for (const line of lrcText.split(/\r?\n/)) {
    const matches = [...line.matchAll(/\[(\d{2,}):(\d{2})(?:[.:](\d{2,3}))?\]/g)];
    if (matches.length === 0) continue;

    const text = line
      .replace(/\[\d{2,}:\d{2}(?:[.:]\d{2,3})?\]/g, "")
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, "")
      .trim();

    if (!text) continue;

    for (const match of matches) {
      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseInt(match[2], 10);
      const msText = match[3] || "0";
      const milliseconds = Number.parseInt(msText, 10) / (msText.length === 3 ? 1000 : 100);
      result.push({ time: minutes * 60 + seconds + milliseconds, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

function parseLrc(lrcText: string, translationText = ""): LyricLine[] {
  const sourceLines = collectLrcLines(lrcText);
  if (!translationText) return sourceLines;

  const translations = new Map(
    collectLrcLines(translationText).map((line) => [line.time.toFixed(2), line.text]),
  );

  return sourceLines.map((line) => {
    const translated = translations.get(line.time.toFixed(2));
    return translated && translated !== line.text
      ? { ...line, text: `${line.text}\n${translated}` }
      : line;
  });
}

function normalizeSongs(rawSongs: unknown[]): MusicSong[] {
  return rawSongs
    .map((song) => {
      const item = song as Partial<MusicSong>;
      if (!item?.id || !item?.src) return null;

      const title = item.title || item.name || `Song ${item.id}`;
      const artist = item.artist || item.author || "Unknown Artist";
      const cover = normalizeMusicCover(item.cover || item.pic);

      return {
        ...item,
        id: String(item.id),
        title,
        artist,
        cover,
        src: item.src,
        lrc: item.lrc || item.lyric || "",
        tlyric: item.tlyric || "",
        name: item.name || title,
        author: item.author || artist,
        pic: cover,
      } as MusicSong;
    })
    .filter(Boolean) as MusicSong[];
}

const MUSIC_PLAYLIST_CACHE_KEY = "iv0:music-playlist:v3";
const MUSIC_PLAYLIST_CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const MUSIC_PLAYLIST_CACHE_LIMIT = 50;

function readCachedPlaylist(idsKey: string) {
  try {
    const raw = window.localStorage.getItem(MUSIC_PLAYLIST_CACHE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as { idsKey?: string; cachedAt?: number; songs?: unknown[] };
    if (data.idsKey !== idsKey || !data.cachedAt || Date.now() - data.cachedAt > MUSIC_PLAYLIST_CACHE_MAX_AGE) {
      return null;
    }

    const songs = normalizeSongs(Array.isArray(data.songs) ? data.songs : []);
    return songs.length > 0 ? songs : null;
  } catch {
    return null;
  }
}

function writeCachedPlaylist(idsKey: string, songs: MusicSong[]) {
  try {
    window.localStorage.setItem(
      MUSIC_PLAYLIST_CACHE_KEY,
      JSON.stringify({ idsKey, cachedAt: Date.now(), songs: songs.slice(0, MUSIC_PLAYLIST_CACHE_LIMIT) }),
    );
  } catch {
    // Storage may be unavailable in private mode.
  }
}

function songMetadataScore(song: MusicSong) {
  const title = (song.title || song.name || "").trim();
  const artist = (song.artist || song.author || "").trim();
  const isWeakTitle =
    !title ||
    title === `Song ${song.id}` ||
    title.includes(` ${song.id}`) ||
    title.includes(`-${song.id}`) ||
    /^(NetEase Song|网易云歌曲)/i.test(title);
  const isWeakArtist = !artist || artist === "Unknown Artist" || artist === "未知歌手";

  return (
    (isWeakTitle ? 0 : 4) +
    (isWeakArtist ? 0 : 3) +
    (song.cover && song.pic ? 2 : song.cover || song.pic ? 1 : 0) +
    (song.lrc || song.lyric ? 3 : 0) +
    (song.tlyric ? 2 : 0) +
    (song.duration && song.duration > 0 ? 1 : 0) +
    (song.source === "netease-fallback" ? 0 : 1)
  );
}

function mergeSongMetadata(primary: MusicSong, secondary?: MusicSong) {
  if (!secondary) return primary;
  const better = songMetadataScore(primary) >= songMetadataScore(secondary) ? primary : secondary;
  const other = better === primary ? secondary : primary;
  const title = better.title || better.name || other.title || other.name || `Song ${better.id}`;
  const artist = better.artist || better.author || other.artist || other.author || "Unknown Artist";
  const cover = normalizeMusicCover(better.cover || better.pic || other.cover || other.pic);
  const lrc = better.lrc || better.lyric || other.lrc || other.lyric || "";
  const tlyric = better.tlyric || other.tlyric || "";

  return {
    ...other,
    ...better,
    title,
    artist,
    cover,
    src: primary.src || secondary.src,
    lrc,
    lyric: lrc,
    tlyric,
    name: title,
    author: artist,
    pic: cover,
    duration: better.duration || other.duration || 0,
  };
}

function mergeCachedPlaylist(cachedSongs: MusicSong[] | null, freshSongs: MusicSong[]) {
  if (!cachedSongs?.length) return freshSongs;
  const cachedById = new Map(cachedSongs.map((song) => [song.id, song]));
  return freshSongs.map((song) => mergeSongMetadata(song, cachedById.get(song.id)));
}

function playErrorMessage(error?: any) {
  if (error?.name === "NotAllowedError") return "浏览器需要一次明确点击，请点击播放按钮开始播放";
  if (error?.name === "NotSupportedError") return "当前音频格式不被浏览器支持，建议上传 mp3 或 m4a";
  return "当前音频源暂不可播放，可尝试上传本地音源";
}

function audioElementErrorMessage(audio: HTMLAudioElement | null) {
  const code = audio?.error?.code;
  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) return "当前音频格式或源地址不被支持，建议上传 mp3/m4a";
  if (code === MediaError.MEDIA_ERR_NETWORK) return "音频网络连接中断，已尝试使用本地缓存";
  if (code === MediaError.MEDIA_ERR_DECODE) return "音频文件解码失败，建议换成 mp3/m4a";
  return "当前音频源暂不可用";
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const playbackMode = (siteConfig as any).musicPlaybackMode === "local" ? "local" : "cloud";
  const configuredIds = (siteConfig.cloudMusicIds || []).map(String).filter(Boolean).join(",");
  const configuredIdsKey = `${playbackMode}:${configuredIds}`;
  const [playlist, setPlaylist] = useState<MusicSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLyric, setCurrentLyric] = useState("正在连接音乐服务...");
  const [isLoading, setIsLoading] = useState(true);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>("loop");

  const audioRef = useRef<HTMLAudioElement>(null);
  const loadedIdsRef = useRef("");
  const lastTimeUpdateRef = useRef(0);
  const failedSongIdsRef = useRef<Set<string>>(new Set());
  const isPlayingRef = useRef(false);
  const shouldAutoPlayRef = useRef(false);

  const currentSong = playlist[currentIndex] ?? null;
  const currentSongId = currentSong?.id;
  const currentSongSrc = currentSong?.src;
  const currentSongLrc = currentSong?.lrc;
  const currentSongLyric = currentSong?.lyric;
  const currentSongLyrics = currentSong?.lyrics;

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!configuredIds) {
      loadedIdsRef.current = "";
      setPlaylist([]);
      setIsLoading(false);
      setCurrentLyric("请先在配置中填写 cloudMusicIds");
      return;
    }

    if (loadedIdsRef.current === configuredIdsKey) return;

    let isMounted = true;
    let didTimeout = false;
    const controller = new AbortController();
    const requestTimeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 32000);

    const loadMusic = async () => {
      setIsLoading(true);
      setCurrentLyric("正在读取歌单...");

      const cachedSongs = readCachedPlaylist(configuredIdsKey);
      if (cachedSongs && isMounted) {
        setPlaylist(cachedSongs);
        setCurrentIndex((index) => (index >= cachedSongs.length ? 0 : index));
        setIsLoading(false);
        setCurrentLyric("已使用本地缓存歌单，正在尝试刷新...");
      }

      try {
        const response = await fetch(`/api/music?ids=${encodeURIComponent(configuredIds)}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Music api failed: ${response.status}`);

        const data = await response.json().catch(() => ({}));
        const songs = mergeCachedPlaylist(cachedSongs, normalizeSongs(Array.isArray(data.songs) ? data.songs : []));

        if (!isMounted) return;

        if (songs.length > 0) {
          loadedIdsRef.current = configuredIdsKey;
          failedSongIdsRef.current.clear();
          setPlaylist(songs);
          setCurrentIndex((index) => (index >= songs.length ? 0 : index));
          writeCachedPlaylist(configuredIdsKey, songs);
          setCurrentLyric(data.failedIds?.length ? "部分歌曲受限，已加载可用曲目" : "歌单已就绪");
        } else {
          const fallbackSongs = cachedSongs || readCachedPlaylist(configuredIdsKey);
          if (fallbackSongs) {
            loadedIdsRef.current = configuredIdsKey;
            setPlaylist(fallbackSongs);
            setCurrentIndex((index) => (index >= fallbackSongs.length ? 0 : index));
            setCurrentLyric("网络不佳，已继续使用本地缓存歌单");
            return;
          }
          loadedIdsRef.current = "";
          setPlaylist([]);
          setCurrentIndex(0);
          setCurrentLyric(data.message || "音乐服务暂时不可用");
        }
      } catch {
        if (!isMounted || (controller.signal.aborted && !didTimeout)) return;
        const fallbackSongs = cachedSongs || readCachedPlaylist(configuredIdsKey);
        if (fallbackSongs) {
          loadedIdsRef.current = configuredIdsKey;
          setPlaylist(fallbackSongs);
          setCurrentIndex((index) => (index >= fallbackSongs.length ? 0 : index));
          setCurrentLyric(didTimeout ? "音乐连接超时，已继续使用本地缓存歌单" : "音乐连接失败，已继续使用本地缓存歌单");
          return;
        }
        loadedIdsRef.current = "";
        setPlaylist([]);
        setCurrentIndex(0);
        setCurrentLyric(didTimeout ? "音乐服务连接超时，请稍后重试" : "音乐服务连接失败，请稍后重试");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const delay = pathname === "/" || pathname === "/music" ? 100 : 800;
    const timeoutId = window.setTimeout(loadMusic, delay);

    return () => {
      isMounted = false;
      controller.abort();
      window.clearTimeout(timeoutId);
      window.clearTimeout(requestTimeoutId);
    };
  }, [configuredIds, configuredIdsKey, pathname]);

  useEffect(() => {
    if (!currentSongId) {
      setLyrics([]);
      return;
    }

    const parsed = Array.isArray(currentSongLyrics)
      ? currentSongLyrics
      : parseLrc(currentSongLrc || currentSongLyric || "");

    setLyrics(parsed);
    setCurrentLyric(parsed.length > 0 ? "歌词已就绪" : "♪ 纯享音乐 ♪");
  }, [currentSongId, currentSongLrc, currentSongLyric, currentSongLyrics]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSongSrc) return;

    setProgress(0);
    setCurrentTime(0);
    // 立即用 API 返回的时长作为初始值，不等 audio metadata 加载
    if (currentSong?.duration && currentSong.duration > 0) {
      setDuration(currentSong.duration);
    } else {
      setDuration(0);
    }
    audio.load();

    if (isPlayingRef.current || shouldAutoPlayRef.current) {
      shouldAutoPlayRef.current = false;
      audio.play().then(() => setIsPlaying(true)).catch((error) => {
        setIsPlaying(false);
        setCurrentLyric(playErrorMessage(error));
      });
    }
  }, [currentSongSrc, currentSong?.duration]);

  const pickNextIndex = useCallback((reverse = false) => {
    if (playlist.length <= 1) return currentIndex;

    if (playMode === "random" && !reverse) {
      const candidates = playlist
        .map((song, index) => ({ song, index }))
        .filter(({ song, index }) => index !== currentIndex && !failedSongIdsRef.current.has(song.id));
      if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)].index;
    }

    for (let step = 1; step < playlist.length; step += 1) {
      const nextIndex = reverse
        ? (currentIndex - step + playlist.length) % playlist.length
        : (currentIndex + step) % playlist.length;
      if (!failedSongIdsRef.current.has(playlist[nextIndex].id)) return nextIndex;
    }

    return currentIndex;
  }, [currentIndex, playlist, playMode]);

  const nextSong = useCallback(() => {
    if (playlist.length === 0) return;
    shouldAutoPlayRef.current = isPlayingRef.current;
    setCurrentIndex(pickNextIndex(false));
  }, [pickNextIndex, playlist.length]);

  const prevSong = useCallback(() => {
    if (playlist.length === 0) return;
    shouldAutoPlayRef.current = isPlayingRef.current;
    setCurrentIndex(pickNextIndex(true));
  }, [pickNextIndex, playlist.length]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    audio.play()
      .then(() => setIsPlaying(true))
      .catch((error) => {
        setIsPlaying(false);
        setCurrentLyric(playErrorMessage(error));
      });
  };

  const playSong = (index: number) => {
    if (index < 0 || index >= playlist.length) return;

    setCurrentIndex(index);

    if (index === currentIndex && audioRef.current) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((error) => {
          setIsPlaying(false);
          setCurrentLyric(playErrorMessage(error));
        });
    } else {
      shouldAutoPlayRef.current = false;
      setIsPlaying(false);
      setCurrentLyric("已选择歌曲，点击播放按钮开始播放");
    }
  };

  const selectSong = playSong;

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const now = performance.now();
    if (now - lastTimeUpdateRef.current < 180) return;
    lastTimeUpdateRef.current = now;

    const nextCurrentTime = audio.currentTime;
    const nextDuration = audio.duration || 0;
    setCurrentTime(nextCurrentTime);
    setDuration(nextDuration);
    setProgress((nextCurrentTime / (nextDuration || 1)) * 100);

    for (let index = lyrics.length - 1; index >= 0; index -= 1) {
      if (nextCurrentTime >= lyrics[index].time) {
        setCurrentLyric(lyrics[index].text);
        break;
      }
    }
  };

  const handleEnded = () => {
    if (!isPlayingRef.current) return;

    if (playMode === "single" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setIsPlaying(false));
      return;
    }

    nextSong();
  };

  const handleAudioError = () => {
    if (!currentSong) return;

    failedSongIdsRef.current.add(currentSong.id);

    if (!isPlayingRef.current && !shouldAutoPlayRef.current) {
      shouldAutoPlayRef.current = false;
      setIsPlaying(false);
      setCurrentLyric(`${audioElementErrorMessage(audioRef.current)}，已暂停自动切换`);
      return;
    }

    if (playlist.length > 1 && failedSongIdsRef.current.size < playlist.length) {
      setCurrentLyric(`${audioElementErrorMessage(audioRef.current)}，正在切换...`);
      shouldAutoPlayRef.current = true;
      setCurrentIndex(pickNextIndex(false));
      return;
    }

    shouldAutoPlayRef.current = false;
    setIsPlaying(false);
    setCurrentLyric("当前歌单音频暂不可播放");
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextProgress = clamp(Number(e.target.value), 0, 100);
    setProgress(nextProgress);

    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = (nextProgress / 100) * audioRef.current.duration;
    }
  };

  const setVolume = (value: number) => {
    const nextVolume = clamp(value, 0, 1);
    setVolumeState(nextVolume);
    if (isMuted && nextVolume > 0) setIsMuted(false);
  };

  const toggleMute = () => setIsMuted((prev) => !prev);

  const togglePlayMode = () => {
    setPlayMode((prev) => {
      if (prev === "loop") return "single";
      if (prev === "single") return "random";
      return "loop";
    });
  };

  return (
    <MusicContext.Provider
      value={{
        playlist,
        currentIndex,
        currentSong,
        isPlaying,
        progress,
        currentTime,
        duration,
        currentLyric,
        isLoading,
        volume,
        isMuted,
        playMode,
        togglePlay,
        nextSong,
        prevSong,
        handleSeek,
        playSong,
        selectSong,
        setVolume,
        toggleMute,
        togglePlayMode,
      }}
    >
      {children}
      {currentSong && (
        <audio
          ref={audioRef}
          src={currentSong.src}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onError={handleAudioError}
          onLoadedMetadata={handleTimeUpdate}
        />
      )}
    </MusicContext.Provider>
  );
}

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useMusic must be used within MusicProvider");
  return context;
};
