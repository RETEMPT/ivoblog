"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { siteConfig } from "../siteConfig";

export default function ProfileCard({
  postCount,
  chatterCount,
  photoCount,
}: {
  postCount: number;
  chatterCount: number;
  photoCount: number;
}) {
  const router = useRouter();

  const openAbout = () => router.push("/about");

  return (
    <div
      onClick={openAbout}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.currentTarget !== e.target) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openAbout();
        }
      }}
      className="uupm-card uupm-anime-frame uupm-halftone uupm-lift uupm-sheen md:col-span-7 rounded-3xl p-5 sm:p-6 md:p-8 flex flex-col justify-between cursor-pointer group relative overflow-hidden h-full min-h-[230px] md:min-h-[290px]"
    >
      <div className="uupm-speed-lines" />
      <div className="uupm-sparkle-field opacity-70">
        <i className="left-[8%] top-[18%]" style={{ animationDelay: "0ms" }} />
        <i className="right-[14%] top-[28%]" style={{ animationDelay: "900ms" }} />
        <i className="right-[30%] bottom-[16%]" style={{ animationDelay: "1500ms" }} />
      </div>
      <div className="absolute -right-10 -top-8 h-24 w-48 rotate-12 bg-blue-500/10 blur-xl transition-opacity duration-700 group-hover:opacity-100 opacity-60" />
      <div className="absolute left-6 bottom-5 h-px w-28 bg-gradient-to-r from-blue-500/50 via-cyan-400/40 to-transparent" />

      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-4 md:gap-6 w-full">
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl md:rounded-2xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-rose-500 p-1 shadow-lg flex-shrink-0 transition-transform duration-500 ease-out group-hover:rotate-2 group-hover:scale-[1.03]">
            <Image
              src={siteConfig.avatarUrl}
              alt="avatar"
              width={96}
              height={96}
              priority
              className="w-full h-full rounded-lg md:rounded-xl object-cover bg-white"
            />
          </div>
          <div className="flex-1 min-w-0">
            <span className="uupm-sticker px-2 py-1 rounded-md">
              <span className="uupm-kicker">Profile</span>
            </span>
            <h1 className="uupm-anime-glow text-xl sm:text-2xl md:text-3xl font-black text-slate-950 dark:text-white mt-1 mb-1 md:mb-2 pb-1 leading-snug transition-colors duration-700 truncate">
              {siteConfig.authorName}
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed max-w-md transition-colors duration-700 line-clamp-2 md:line-clamp-none">
              {siteConfig.bio}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center md:items-end justify-between mt-6 md:mt-8 gap-5 md:gap-6 relative z-10">
        <div className="flex gap-2 sm:gap-6 w-full md:w-auto justify-between sm:justify-around md:justify-start px-2 sm:px-0">
          <StatItem count={postCount} label="Posts" color="text-indigo-600 dark:text-indigo-400" />
          <div className="w-px h-8 md:h-10 bg-slate-300/50 dark:bg-slate-700 hidden md:block" />
          <StatItem count={chatterCount} label="Notes" color="text-purple-600 dark:text-purple-400" />
          <div className="w-px h-8 md:h-10 bg-slate-300/50 dark:bg-slate-700 hidden md:block" />
          <StatItem count={photoCount} label="Photos" color="text-pink-600 dark:text-pink-400" />
        </div>

        <div className="hidden md:flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/45 dark:bg-slate-900/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
          Personal Blog
        </div>
      </div>
    </div>
  );
}

function StatItem({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className="text-center group/stat px-2">
      <div className={`text-xl md:text-2xl font-black ${color} transition-transform group-hover/stat:scale-110`}>
        {count}
      </div>
      <div className="text-[9px] md:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">
        {label}
      </div>
    </div>
  );
}
