"use client";

import { useTheme } from './ThemeProvider';

// 这里的 export default 非常关键！没有 default 就会报你那个错误
export default function ThemeToggleBlock() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div
      onClick={toggleTheme}
      role="button"
      tabIndex={0}
      aria-pressed={isDark}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleTheme();
        }
      }}
      // 【核心修复】：移除了定高限制 (h-[180px] md:h-auto)，换成了统一的 h-full w-full
      className="uupm-card uupm-anime-frame uupm-halftone uupm-lift uupm-sheen h-full w-full rounded-3xl p-6 flex flex-col justify-center items-center cursor-pointer group relative overflow-hidden"
    >
       <div className="uupm-speed-lines"></div>
       {/* 日夜交替动画图标 */}
       <div className="relative w-20 h-20 rounded-full overflow-hidden mb-3 shadow-inner flex-shrink-0 border border-white/50 dark:border-white/10">
          <div className={`absolute inset-0 transition-transform duration-700 ${isDark ? '-translate-y-full' : 'translate-y-0'} bg-gradient-to-tr from-sky-300 to-yellow-200`}></div>
          <div className={`absolute inset-0 transition-transform duration-700 ${isDark ? 'translate-y-0' : 'translate-y-full'} bg-gradient-to-tr from-slate-950 via-blue-950 to-slate-800`}></div>

          <div className={`absolute top-1/2 left-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300 shadow-[0_0_26px_rgba(250,204,21,0.8)] transition-all duration-700 ${isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`}>
            <span className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-100/70"></span>
          </div>
          <div className={`absolute top-1/2 left-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-100 shadow-[0_0_24px_rgba(191,219,254,0.55)] transition-all duration-700 ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`}>
            <span className="absolute -right-1 -top-1 h-9 w-9 rounded-full bg-slate-900"></span>
            <span className="absolute -left-5 top-1 h-1 w-1 rounded-full bg-blue-100"></span>
            <span className="absolute left-10 top-8 h-1.5 w-1.5 rounded-full bg-blue-100"></span>
          </div>
       </div>
       <div className="text-center z-10 mt-auto">
           <h3 className={`text-xl font-bold transition-colors duration-500 ${isDark ? 'text-white' : 'text-slate-800'}`}>
             {isDark ? '夜间模式' : '日间模式'}
           </h3>
           <p className={`text-sm font-medium mt-1 transition-colors duration-500 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
             {isDark ? '流萤飞舞的深空' : '落樱漫舞的清晨'}
           </p>
       </div>
    </div>
  );
}
