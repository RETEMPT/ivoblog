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

  return (
    <div
      onClick={() => router.push("/about")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.currentTarget !== e.target) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push("/about");
        }
      }}
      className="md:col-span-7 rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-8 flex flex-col justify-between transition-all duration-700 hover:scale-[1.01] cursor-pointer group relative overflow-hidden h-full min-h-[280px]"
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-1 shadow-lg flex-shrink-0 transition-transform duration-500 group-hover:rotate-3">
            <Image
              src={siteConfig.avatarUrl}
              alt="avatar"
              width={96}
              height={96}
              priority
              className="w-full h-full rounded-xl object-cover bg-white"
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-wider transition-colors duration-700">
              {siteConfig.authorName}
            </h1>
            <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed max-w-md transition-colors duration-700">
              {siteConfig.bio}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-end md:items-center justify-between mt-8 gap-6 relative z-10">
        <div className="flex gap-6 w-full md:w-auto justify-around md:justify-start">
          <StatItem count={postCount} label="Posts" color="text-indigo-600 dark:text-indigo-400" />
          <div className="w-px h-10 bg-slate-300/50 dark:bg-slate-700 hidden md:block" />
          <StatItem count={chatterCount} label="Notes" color="text-purple-600 dark:text-purple-400" />
          <div className="w-px h-10 bg-slate-300/50 dark:bg-slate-700 hidden md:block" />
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
    <div className="text-center group/stat">
      <div className={`text-2xl font-black ${color} transition-transform group-hover/stat:scale-110`}>{count}</div>
      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</div>
    </div>
  );
}
