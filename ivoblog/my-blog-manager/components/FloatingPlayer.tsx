"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ListMusic,
  Pause,
  Play,
  RefreshCcw,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useMusic } from "./MusicProvider";

const formatTime = (time: number) => {
  if (!time || Number.isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export default function FloatingPlayer() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    playlist,
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
    setVolume,
    toggleMute,
    togglePlayMode,
  } = useMusic();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || isLoading || !currentSong || pathname === "/" || pathname === "/music") return null;

  const modeIcon =
    playMode === "random" ? <Shuffle size={18} /> : playMode === "single" ? <RefreshCcw size={18} /> : <Repeat size={18} />;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 88, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 88, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 32 }}
        className="fixed inset-x-0 bottom-0 z-[9990] hidden lg:block px-5 pb-4 pointer-events-none"
      >
        <style>{`
          .iv0-bottom-player-range {
            -webkit-appearance: none;
            appearance: none;
            background: transparent;
          }
          .iv0-bottom-player-range::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 999px;
            background: #2563eb;
            border: 2px solid rgba(255,255,255,0.92);
            box-shadow: 0 4px 14px rgba(37,99,235,0.35);
          }
          .iv0-bottom-player-range::-moz-range-thumb {
            width: 12px;
            height: 12px;
            border-radius: 999px;
            background: #2563eb;
            border: 2px solid rgba(255,255,255,0.92);
            box-shadow: 0 4px 14px rgba(37,99,235,0.35);
          }
        `}</style>

        <div className="pointer-events-auto mx-auto max-w-6xl overflow-hidden rounded-[26px] border border-white/60 bg-white/78 shadow-[0_18px_48px_rgba(15,23,42,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/78 dark:shadow-[0_18px_54px_rgba(0,0,0,0.42)]">
          <div className="relative h-2 bg-slate-200/70 dark:bg-white/10">
            <input
              type="range"
              min="0"
              max="100"
              value={progress || 0}
              onChange={handleSeek}
              aria-label="Seek music"
              className="iv0-bottom-player-range absolute inset-0 h-2 w-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, #2563eb ${progress || 0}%, transparent ${progress || 0}%)`,
              }}
            />
          </div>

          <div className="grid h-[82px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6 px-5">
            <button
              type="button"
              onClick={() => router.push("/music")}
              className="flex min-w-0 items-center gap-4 text-left"
              aria-label="Open music page"
            >
              <div
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-200 shadow-lg ring-1 ring-white/70 dark:bg-slate-800 dark:ring-white/10"
                style={{ transform: "translateZ(0)" }}
              >
                <img src={currentSong.cover || currentSong.pic} alt="cover" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                <div className={`absolute inset-0 rounded-2xl ring-2 ring-blue-500/35 transition-opacity duration-500 ${isPlaying ? "opacity-100" : "opacity-0"}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900 dark:text-white">{currentSong.title || currentSong.name}</p>
                <p className="truncate text-xs font-bold text-slate-500 dark:text-slate-400">{currentSong.artist || currentSong.author}</p>
                <p className="mt-1 truncate text-[11px] font-semibold text-blue-700/80 dark:text-blue-300/80">{currentLyric}</p>
              </div>
            </button>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={prevSong}
                aria-label="Previous song"
                className="grid h-10 w-10 place-items-center rounded-full text-slate-600 transition hover:bg-slate-900/5 hover:text-blue-600 active:scale-95 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <SkipBack size={22} fill="currentColor" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-600/30 transition hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 active:scale-95"
              >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} className="ml-0.5" fill="currentColor" />}
              </button>
              <button
                type="button"
                onClick={nextSong}
                aria-label="Next song"
                className="grid h-10 w-10 place-items-center rounded-full text-slate-600 transition hover:bg-slate-900/5 hover:text-blue-600 active:scale-95 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <SkipForward size={22} fill="currentColor" />
              </button>
            </div>

            <div className="flex min-w-0 items-center justify-end gap-3">
              <span className="hidden min-w-20 text-right text-[11px] font-bold tabular-nums text-slate-500 dark:text-slate-400 xl:block">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <button
                type="button"
                onClick={togglePlayMode}
                aria-label="Toggle play mode"
                className={`grid h-9 w-9 place-items-center rounded-full transition active:scale-95 ${
                  playMode === "loop"
                    ? "text-slate-500 hover:bg-slate-900/5 dark:text-slate-400 dark:hover:bg-white/10"
                    : "bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300"
                }`}
              >
                {modeIcon}
              </button>
              <button
                type="button"
                onClick={toggleMute}
                aria-label="Mute"
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-900/5 hover:text-blue-600 active:scale-95 dark:text-slate-400 dark:hover:bg-white/10"
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                aria-label="Volume"
                className="iv0-bottom-player-range h-2 w-24 cursor-pointer rounded-full"
                style={{
                  background: `linear-gradient(to right, #2563eb ${(isMuted ? 0 : volume) * 100}%, rgba(148,163,184,0.34) ${(isMuted ? 0 : volume) * 100}%)`,
                }}
              />
              <button
                type="button"
                onClick={() => router.push("/music")}
                aria-label="Open playlist"
                className="flex h-9 items-center gap-2 rounded-full bg-slate-900 px-3 text-xs font-black text-white shadow-lg transition hover:-translate-y-0.5 active:translate-y-0 dark:bg-white dark:text-slate-950"
              >
                <ListMusic size={16} />
                {playlist.length}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
