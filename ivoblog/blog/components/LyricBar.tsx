"use client";
import { useEffect, useState } from 'react';
import { useMusic } from './MusicProvider';

export default function LyricBar() {
  const { isPlaying, currentLyric, currentSong } = useMusic();
  const [displayedLyric, setDisplayedLyric] = useState("");

  useEffect(() => {
    setDisplayedLyric("");
    let i = 0;
    const targetText = currentLyric || "";
    if (!targetText) return;

    const typingInterval = setInterval(() => {
      if (document.hidden) return;
      if (i <= targetText.length) {
        setDisplayedLyric(targetText.slice(0, i));
        i++;
      } else {
        clearInterval(typingInterval);
      }
    }, 50);

    return () => clearInterval(typingInterval);
  }, [currentLyric]);

  if (!currentSong) return null;

  // 这里的波浪数据，方便循环渲染，减少代码冗余
  const waves = [
    { color: 'bg-blue-400', delay: '0ms' },
    { color: 'bg-cyan-400', delay: '200ms' },
    { color: 'bg-blue-500', delay: '400ms' },
    { color: 'bg-rose-400', delay: '100ms' },
    { color: 'bg-cyan-300', delay: '300ms' },
  ];

  return (
    <>
      <style>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-cursor {
          animation: cursorBlink 0.8s step-end infinite;
        }
        /* UI Pro Max: 用 transform 做波形，避免 height 动画触发布局重排 */
        @keyframes safeWave {
          0%, 100% { transform: scaleY(0.32); }
          50% { transform: scaleY(1); }
        }
        .safe-wave-active {
          animation: safeWave 1s ease-in-out infinite;
          transform-origin: bottom;
          will-change: transform;
        }
      `}</style>

      <div className="uupm-card w-full rounded-3xl bg-slate-950/85 dark:bg-slate-950/90 border-white/10 p-5 flex items-center justify-between transition-all duration-700 hover:shadow-blue-500/20 group h-20">

        {/* 1. 音频波形动态部分：改用统一渲染逻辑实现过渡 */}
        <div className="flex items-end justify-center gap-[4px] h-8 w-16">
          {waves.map((wave, index) => (
            <div
              key={index}
              className={`w-1.5 h-7 origin-bottom rounded-t-sm transition-transform duration-500 ease-out ${
                isPlaying 
                  ? `${wave.color} safe-wave-active` 
                  : 'bg-slate-600 shadow-none'
              }`}
              style={{
                animationDelay: wave.delay,
                transform: isPlaying ? undefined : 'scaleY(0.18)'
              }}
            ></div>
          ))}
        </div>

        {/* 2. 歌词显示区 */}
        <div className="flex-1 px-8 flex justify-center items-center overflow-hidden">
          <p className="text-white text-base sm:text-lg font-bold truncate drop-shadow-[0_0_8px_rgba(37,99,235,0.75)]">
            {displayedLyric}
            <span className="inline-block w-[3px] h-5 bg-blue-400 align-middle ml-1 shadow-[0_0_8px_rgba(37,99,235,0.8)] animate-cursor"></span>
          </p>
        </div>

        {/* 3. 右侧音乐图标 */}
        <div className="w-16 flex justify-end">
          <svg className={`w-6 h-6 text-blue-300/60 transition-all duration-500 ${isPlaying ? 'opacity-100 scale-105' : 'opacity-30 scale-95'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      </div>
    </>
  );
}
