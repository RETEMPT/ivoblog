"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Disc3,
  ListMusic,
  Mic2,
  Pause,
  Play,
  RefreshCcw,
  Repeat,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Navbar from "../../components/Navbar";
import PageTransition from "../../components/PageTransition";
import SafeImage from "../../components/SafeImage";
import { useMusic } from "../../components/MusicProvider";

type LyricLine = {
  time: number;
  text: string;
};

type SongLike = {
  id: string;
  title?: string;
  name?: string;
  artist?: string;
  author?: string;
  cover?: string;
  pic?: string;
  lrc?: string;
  lyric?: string;
  tlyric?: string;
  lyrics?: LyricLine[] | string;
};

const FALLBACK_COVER = "/uploads/images/music-default-cover.svg";

function formatTime(time: number) {
  if (!time || Number.isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function parseRawLyrics(rawLrc: string): { lines: LyricLine[]; hasTimedLine: boolean } {
  if (!rawLrc || typeof rawLrc !== "string") return { lines: [], hasTimedLine: false };

  const parsed: LyricLine[] = [];
  const timeExp = /\[(\d{2,}):(\d{2})(?:[.:](\d{2,3}))?\]/g;
  let hasTimedLine = false;

  for (const line of rawLrc.split(/\r?\n/)) {
    const text = line.replace(/\[\d{2,}:\d{2}(?:[.:]\d{2,3})?\]/g, "").trim();
    if (!text) continue;

    const matches = [...line.matchAll(timeExp)];
    if (matches.length === 0) {
      parsed.push({ time: -1, text });
      continue;
    }

    hasTimedLine = true;
    for (const match of matches) {
      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseInt(match[2], 10);
      const msText = match[3] || "0";
      const milliseconds = Number.parseInt(msText, 10) / (msText.length === 3 ? 1000 : 100);
      parsed.push({ time: minutes * 60 + seconds + milliseconds, text });
    }
  }

  return {
    lines: hasTimedLine ? parsed.filter((line) => line.time >= 0).sort((a, b) => a.time - b.time) : parsed,
    hasTimedLine,
  };
}

function parseLyrics(song: SongLike | null): LyricLine[] {
  if (!song) return [];

  if (Array.isArray(song.lyrics)) {
    return song.lyrics;
  }

  const rawLrc = song.lrc || song.lyric || (typeof song.lyrics === "string" ? song.lyrics : "");
  const source = parseRawLyrics(rawLrc);
  if (source.lines.length === 0 || !source.hasTimedLine) return source.lines;

  const translations = new Map(
    parseRawLyrics(song.tlyric || "").lines.map((line) => [line.time.toFixed(2), line.text]),
  );

  return source.lines.map((line) => {
    const translated = translations.get(line.time.toFixed(2));
    return translated && translated !== line.text
      ? { ...line, text: `${line.text}\n${translated}` }
      : line;
  });
}

export default function MusicClient() {
  const {
    playlist,
    currentIndex,
    currentSong,
    isPlaying,
    progress,
    currentTime,
    duration,
    currentLyric,
    isLoading,
    togglePlay,
    nextSong,
    prevSong,
    handleSeek,
    playSong,
    playMode,
    togglePlayMode,
    volume,
    setVolume,
    isMuted,
    toggleMute,
  } = useMusic();

  const lyricContainerRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLButtonElement>(null);
  const [activePanel, setActivePanel] = useState<"lyrics" | "playlist">("lyrics");
  const [searchQuery, setSearchQuery] = useState("");

  const song = currentSong as SongLike | null;
  const songCover = song?.cover || song?.pic || FALLBACK_COVER;
  const songTitle = song?.title || song?.name || "Unknown Track";
  const songArtist = song?.artist || song?.author || "Unknown Artist";
  const parsedLyrics = useMemo(() => parseLyrics(song), [song]);
  const hasTimedLyrics = parsedLyrics.some((line) => line.time >= 0);

  const activeLyricIndex = useMemo(() => {
    if (!hasTimedLyrics) return -1;
    const nextIndex = parsedLyrics.findIndex((line) => line.time > currentTime);
    if (nextIndex === -1) return parsedLyrics.length - 1;
    return Math.max(0, nextIndex - 1);
  }, [currentTime, hasTimedLyrics, parsedLyrics]);

  const filteredPlaylist = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return playlist;

    return playlist.filter((item) => {
      const track = item as SongLike;
      return `${track.title || track.name || ""} ${track.artist || track.author || ""}`.toLowerCase().includes(query);
    });
  }, [playlist, searchQuery]);

  useEffect(() => {
    if (!activeLyricRef.current || !lyricContainerRef.current || activePanel !== "lyrics") return;

    const container = lyricContainerRef.current;
    const activeItem = activeLyricRef.current;
    const targetTop = activeItem.offsetTop - container.offsetHeight / 2 + activeItem.offsetHeight / 2;
    container.scrollTo({ top: targetTop, behavior: "smooth" });
  }, [activeLyricIndex, activePanel]);

  const seekToPercent = (value: number) => {
    const clamped = Math.min(100, Math.max(0, value));
    handleSeek({ target: { value: String(clamped) } } as ChangeEvent<HTMLInputElement>);
  };

  const playModeIcon =
    playMode === "random" ? <Shuffle size={18} /> : playMode === "single" ? <RefreshCcw size={18} /> : <Repeat size={18} />;

  if (isLoading) {
    return (
      <div className="relative flex min-h-screen flex-col pb-28">
        <Navbar />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Disc3 size={52} className="animate-spin text-blue-600" />
          <p className="text-sm font-black tracking-[0.24em] text-slate-500">LOADING MUSIC</p>
        </div>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="relative flex min-h-screen flex-col pb-28">
        <Navbar />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Disc3 size={52} className="text-slate-400" />
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white">音乐暂不可用</h1>
            <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-400">{currentLyric || "请检查歌曲 ID 或稍后重试"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden pb-36">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-[-12%] bg-cover bg-center opacity-35 blur-[56px] saturate-150 transition-all duration-700 dark:opacity-25"
          style={{ backgroundImage: `url(${songCover})` }}
        />
        <div className="absolute inset-0 bg-slate-50/78 backdrop-blur-sm dark:bg-slate-950/78" />
      </div>

      <Navbar />

      <PageTransition>
        <main className="relative z-10 mx-auto mt-24 flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 sm:px-6 lg:mt-28 lg:px-8">
          <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-blue-600 dark:text-blue-300">Cloud Player</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">音乐空间</h1>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/55 px-4 py-2 text-xs font-black text-slate-600 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/55 dark:text-slate-300">
              <ListMusic size={16} />
              {playlist.length} 首曲目
            </div>
          </header>

          <section className="grid min-h-[620px] grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)_330px]">
            <motion.article
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/58 p-5 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/58"
            >
              <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-blue-500/15 blur-3xl" />
              <div className="relative flex h-full flex-col">
                <div className="relative aspect-square overflow-hidden rounded-[24px] bg-slate-200 shadow-2xl ring-1 ring-white/70 dark:bg-slate-800 dark:ring-white/10">
                  <SafeImage
                    src={songCover}
                    fallbackSrc={FALLBACK_COVER}
                    alt="cover"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-5">
                    <p className="line-clamp-2 text-2xl font-black text-white drop-shadow">{songTitle}</p>
                    <p className="mt-1 truncate text-sm font-bold text-white/78">{songArtist}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-lg dark:bg-white dark:text-slate-950">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black uppercase tracking-[0.22em] opacity-60">Now Playing</p>
                    <p className="mt-1 truncate text-sm font-black">{currentLyric || "享受这一刻"}</p>
                  </div>
                  <div className={`ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white ${isPlaying ? "animate-pulse" : ""}`}>
                    <Mic2 size={18} />
                  </div>
                </div>

                <div className="mt-auto grid grid-cols-3 gap-2 pt-5 text-center">
                  <div className="rounded-2xl bg-white/55 p-3 dark:bg-white/5">
                    <p className="text-[10px] font-black uppercase text-slate-400">Track</p>
                    <p className="mt-1 text-sm font-black text-slate-800 dark:text-white">{currentIndex + 1}</p>
                  </div>
                  <div className="rounded-2xl bg-white/55 p-3 dark:bg-white/5">
                    <p className="text-[10px] font-black uppercase text-slate-400">Mode</p>
                    <p className="mt-1 text-sm font-black capitalize text-slate-800 dark:text-white">{playMode}</p>
                  </div>
                  <div className="rounded-2xl bg-white/55 p-3 dark:bg-white/5">
                    <p className="text-[10px] font-black uppercase text-slate-400">Time</p>
                    <p className="mt-1 text-sm font-black text-slate-800 dark:text-white">{formatTime(duration)}</p>
                  </div>
                </div>
              </div>
            </motion.article>

            <motion.article
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 }}
              className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/50 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/50"
            >
              <div className="flex items-center justify-center gap-1 border-b border-white/50 p-3 dark:border-white/10 lg:hidden">
                <button
                  type="button"
                  onClick={() => setActivePanel("lyrics")}
                  className={`flex-1 rounded-2xl py-2 text-xs font-black transition ${activePanel === "lyrics" ? "bg-blue-600 text-white" : "text-slate-500"}`}
                >
                  歌词
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel("playlist")}
                  className={`flex-1 rounded-2xl py-2 text-xs font-black transition ${activePanel === "playlist" ? "bg-blue-600 text-white" : "text-slate-500"}`}
                >
                  歌单
                </button>
              </div>

              <div className={`${activePanel === "lyrics" ? "block" : "hidden"} h-[560px] lg:block lg:h-full`}>
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-white/80 to-transparent dark:from-slate-950/90" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-white/80 to-transparent dark:from-slate-950/90" />
                <div ref={lyricContainerRef} className="music-scroll-mask h-full overflow-y-auto px-5 py-28 text-center no-scrollbar md:px-10">
                  {parsedLyrics.length > 0 ? (
                    <div className="flex flex-col gap-4">
                      {parsedLyrics.map((line, index) => {
                        const active = index === activeLyricIndex;
                        return (
                          <button
                            type="button"
                            key={`${line.time}-${index}-${line.text}`}
                            ref={active ? activeLyricRef : null}
                            onClick={() => line.time >= 0 && duration > 0 && seekToPercent((line.time / duration) * 100)}
                            className={`mx-auto max-w-3xl rounded-2xl px-4 py-2 text-center transition-all duration-500 ${
                              active
                                ? "scale-[1.03] bg-blue-600/10 text-blue-700 opacity-100 dark:text-blue-300"
                                : "text-slate-600 opacity-35 hover:opacity-70 dark:text-slate-300"
                            }`}
                          >
                            <span className={`${active ? "text-2xl md:text-3xl" : "text-base md:text-xl"} whitespace-pre-line font-black leading-relaxed`}>
                              {line.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4">
                      <Disc3 size={44} className="animate-spin text-blue-500/50" />
                      <p className="text-xl font-black text-slate-700 dark:text-slate-200">{currentLyric || "暂无歌词"}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.article>

            <motion.aside
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className={`${activePanel === "playlist" ? "block" : "hidden"} rounded-[28px] border border-white/60 bg-white/54 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/54 lg:block`}
            >
              <div className="relative mb-4">
                <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索歌曲或歌手"
                  className="h-12 w-full rounded-2xl border border-white/60 bg-white/70 pl-11 pr-11 text-sm font-bold outline-none transition focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-slate-900/80"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="custom-scrollbar flex max-h-[540px] flex-col gap-2 overflow-y-auto pr-1">
                <AnimatePresence mode="popLayout">
                  {filteredPlaylist.map((item, index) => {
                    const track = item as SongLike;
                    const originalIndex = playlist.findIndex((candidate) => candidate.id === track.id);
                    const active = track.id === song.id;
                    return (
                      <motion.button
                        layout
                        type="button"
                        key={track.id || index}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        onClick={() => originalIndex >= 0 && playSong(originalIndex)}
                        className={`group flex items-center gap-3 rounded-2xl p-3 text-left transition ${
                          active ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-white/45 hover:bg-white/75 dark:bg-white/5 dark:hover:bg-white/10"
                        }`}
                      >
                        <SafeImage
                          src={track.cover || track.pic || FALLBACK_COVER}
                          fallbackSrc={FALLBACK_COVER}
                          alt="cover"
                          className="h-12 w-12 shrink-0 rounded-xl object-cover shadow-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-black ${active ? "text-white" : "text-slate-800 dark:text-white"}`}>
                            {track.title || track.name || "Unknown Track"}
                          </p>
                          <p className={`mt-1 truncate text-[11px] font-bold ${active ? "text-white/70" : "text-slate-500 dark:text-slate-400"}`}>
                            {track.artist || track.author || "Unknown Artist"}
                          </p>
                        </div>
                        {active && isPlaying && (
                          <span className="flex h-6 w-6 shrink-0 items-end justify-center gap-[3px]">
                            <i className="h-2 w-1 animate-musicbar rounded-full bg-white" />
                            <i className="h-4 w-1 animate-musicbar rounded-full bg-white [animation-delay:160ms]" />
                            <i className="h-3 w-1 animate-musicbar rounded-full bg-white [animation-delay:320ms]" />
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.aside>
          </section>
        </main>
      </PageTransition>

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[26px] border border-white/60 bg-white/82 shadow-[0_20px_56px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/82">
          <div className="relative h-2 bg-slate-200/80 dark:bg-white/10">
            <input
              type="range"
              min="0"
              max="100"
              value={progress || 0}
              onChange={handleSeek}
              className="music-range absolute inset-0 h-2 w-full cursor-pointer"
              style={{ background: `linear-gradient(to right, #2563eb ${progress || 0}%, transparent ${progress || 0}%)` }}
              aria-label="播放进度"
            />
          </div>

          <div className="grid min-h-[86px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <SafeImage
                src={songCover}
                fallbackSrc={FALLBACK_COVER}
                alt="cover"
                className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-md"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950 dark:text-white">{songTitle}</p>
                <p className="truncate text-xs font-bold text-slate-500 dark:text-slate-400">{songArtist}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={prevSong} className="grid h-10 w-10 place-items-center rounded-full text-slate-600 transition hover:bg-slate-900/5 hover:text-blue-600 active:scale-95 dark:text-slate-300 dark:hover:bg-white/10" aria-label="上一首">
                <SkipBack size={22} fill="currentColor" />
              </button>
              <button type="button" onClick={togglePlay} className="grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-600/30 transition hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 active:scale-95" aria-label={isPlaying ? "暂停" : "播放"}>
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} className="ml-0.5" fill="currentColor" />}
              </button>
              <button type="button" onClick={nextSong} className="grid h-10 w-10 place-items-center rounded-full text-slate-600 transition hover:bg-slate-900/5 hover:text-blue-600 active:scale-95 dark:text-slate-300 dark:hover:bg-white/10" aria-label="下一首">
                <SkipForward size={22} fill="currentColor" />
              </button>
            </div>

            <div className="hidden min-w-0 items-center justify-end gap-3 md:flex">
              <span className="min-w-24 text-right text-[11px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <button type="button" onClick={togglePlayMode} className={`grid h-9 w-9 place-items-center rounded-full transition active:scale-95 ${playMode === "loop" ? "text-slate-500 hover:bg-slate-900/5 dark:hover:bg-white/10" : "bg-blue-600/10 text-blue-600 dark:text-blue-300"}`} aria-label="播放模式">
                {playModeIcon}
              </button>
              <button type="button" onClick={toggleMute} className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-900/5 hover:text-blue-600 active:scale-95 dark:hover:bg-white/10" aria-label="静音">
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                className="music-range h-2 w-24 cursor-pointer rounded-full"
                style={{ background: `linear-gradient(to right, #2563eb ${(isMuted ? 0 : volume) * 100}%, rgba(148,163,184,0.34) ${(isMuted ? 0 : volume) * 100}%)` }}
                aria-label="音量"
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .music-range {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
        }
        .music-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #2563eb;
          border: 2px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
        }
        .music-range::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #2563eb;
          border: 2px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .music-scroll-mask {
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%);
        }
        @keyframes musicbar {
          0%, 100% { transform: scaleY(0.45); opacity: 0.6; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        .animate-musicbar {
          animation: musicbar 900ms ease-in-out infinite;
          transform-origin: bottom;
        }
      `}</style>
    </div>
  );
}
