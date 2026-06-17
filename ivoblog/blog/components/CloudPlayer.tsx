"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMusic } from "./MusicProvider";

const formatTime = (time: number) => {
  if (!time || Number.isNaN(time)) return "00:00";
  const minutes = Math.floor(time / 60).toString().padStart(2, "0");
  const seconds = Math.floor(time % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export default function CloudPlayer() {
  const {
    playlist,
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
  } = useMusic();
  const [displayedLyric, setDisplayedLyric] = useState("");
  const router = useRouter();

  useEffect(() => {
    let index = 0;
    const target = currentLyric || "";
    setDisplayedLyric("");

    if (!target) return;

    const typingInterval = window.setInterval(() => {
      if (document.hidden) return;

      if (index <= target.length) {
        setDisplayedLyric(target.slice(0, index));
        index += 1;
      } else {
        window.clearInterval(typingInterval);
      }
    }, 50);

    return () => {
      window.clearInterval(typingInterval);
      setDisplayedLyric("");
    };
  }, [currentLyric]);

  if (isLoading) {
    return (
      <div className="uupm-card h-full w-full rounded-3xl p-6 flex flex-col items-center justify-center transition-colors duration-700">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-slate-800 dark:text-white font-bold tracking-widest animate-pulse text-sm">CONNECTING...</span>
      </div>
    );
  }

  if (playlist.length === 0 || !currentSong) {
    return (
      <div className="uupm-card h-full w-full rounded-3xl p-6 flex flex-col items-center justify-center transition-all duration-700">
        <div className="w-16 h-16 mb-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shadow-inner opacity-50">
          <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
        <span className="text-slate-500 dark:text-slate-400 font-bold tracking-widest text-xs uppercase">No Music Available</span>
        <span className="text-[10px] text-slate-400 mt-1">Check playlist or network connection</span>
      </div>
    );
  }

  const safeTogglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePlay();
  };

  const safePrevSong = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    prevSong();
  };

  const safeNextSong = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    nextSong();
  };

  const safeHandleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    handleSeek(e);
  };

  return (
    <>
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          transition: transform 0.1s;
        }
        input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.3); }
      `}</style>

      <div
        onClick={() => router.push("/music")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.currentTarget !== e.target) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push("/music");
          }
        }}
        className="uupm-card uupm-anime-frame uupm-lift uupm-sheen h-full w-full rounded-3xl p-6 flex flex-col justify-between relative group overflow-hidden cursor-pointer"
      >
        <div className="uupm-speed-lines" />
        <div className="uupm-sparkle-field opacity-60">
          <i className="left-[12%] top-[22%]" style={{ animationDelay: "300ms" }} />
          <i className="right-[18%] bottom-[22%]" style={{ animationDelay: "1200ms" }} />
        </div>
        <div className={`absolute -top-10 -right-12 h-24 w-52 rotate-12 bg-blue-500/20 blur-2xl transition-opacity duration-1000 ${isPlaying ? "opacity-100" : "opacity-30"}`} />
        <div className="absolute -bottom-12 -left-16 h-24 w-56 -rotate-12 bg-cyan-400/20 blur-2xl" />

        <div className="flex items-center gap-5 relative z-10 mb-6 mt-2">
          <div
            className="w-20 h-20 rounded-full border-2 border-white/50 shadow-lg flex-shrink-0 overflow-hidden relative animate-[spin_6s_linear_infinite]"
            style={{
              animationPlayState: isPlaying ? "running" : "paused",
            }}
          >
            <img src={currentSong.cover} alt="cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-white/80 backdrop-blur-sm rounded-full border border-gray-300 shadow-inner" />
          </div>

          <div className="flex-col overflow-hidden w-full">
            <div className="flex items-center justify-between mb-1">
              <span className="uupm-sticker px-2 py-1 rounded-md transition-colors duration-700">
                <span className="uupm-kicker">Cloud Music</span>
              </span>
            </div>
            <h3 className="uupm-anime-glow text-xl font-black text-slate-900 dark:text-white truncate drop-shadow-sm transition-colors duration-700">
              {currentSong.title}
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate drop-shadow-sm transition-colors duration-700">
              {currentSong.artist}
            </p>
          </div>
        </div>

        <div className="relative z-10 mb-2 h-6 overflow-hidden">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 truncate">{displayedLyric}</p>
        </div>

        <div className="relative z-10 mt-auto">
          <div
            className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-bold mb-3 transition-colors duration-700"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
          >
            <span className="w-10 text-right">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={safeHandleSeek}
              className="flex-1 h-1.5 bg-white/40 dark:bg-slate-700/50 rounded-full appearance-none outline-none cursor-pointer shadow-inner"
              style={{ background: `linear-gradient(to right, #2563eb ${progress}%, rgba(148,163,184,0.4) ${progress}%)` }}
              aria-label="Seek music"
            />
            <span className="w-10">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center justify-center gap-6">
            <button type="button" aria-label="Previous song" onClick={safePrevSong} className="text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-300 drop-shadow-sm relative z-20 hover:-translate-y-0.5 active:translate-y-0">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            <button type="button" aria-label={isPlaying ? "Pause" : "Play"} onClick={safeTogglePlay} className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-600/25 hover:bg-blue-700 hover:scale-105 transition-all duration-300 border-2 border-white/60 dark:border-slate-600 relative z-20 active:scale-95">
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button type="button" aria-label="Next song" onClick={safeNextSong} className="text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-300 drop-shadow-sm relative z-20 hover:-translate-y-0.5 active:translate-y-0">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
