"use client";

import { Cloud, Sun } from "lucide-react";

export default function WeatherWidget() {
  return (
    <div className="w-full h-full rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-6 flex flex-col justify-center transition-all duration-700 hover:scale-[1.02] group relative overflow-hidden">
      <div className="absolute -right-6 -top-6 w-32 h-32 blur-3xl rounded-full transition-colors duration-700 bg-amber-500/20 group-hover:bg-amber-500/40" />
      <div className="flex items-center justify-between relative z-10 w-full">
        <div className="flex flex-col flex-1 pr-2">
          <span className="text-[10px] font-black uppercase tracking-widest mb-1 text-amber-500 dark:text-amber-400">
            LOCAL STATUS
          </span>
          <span className="text-base font-bold text-slate-800 dark:text-white line-clamp-1">Manager</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tighter">Ready</span>
            <span className="text-xs font-bold text-slate-500">Stable</span>
          </div>
        </div>
        <div className="relative z-10 group-hover:scale-110 transition-transform duration-500 drop-shadow-md shrink-0">
          <Cloud className="text-slate-300 dark:text-slate-400" size={38} />
          <Sun className="absolute -right-2 -top-2 text-amber-400" size={18} />
        </div>
      </div>
    </div>
  );
}
