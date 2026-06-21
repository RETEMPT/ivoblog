"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import { ImagePlus, Save, User } from "lucide-react";
import FloatingImageTool from "../editor/FloatingImageTool";

type ImageField = "avatarUrl" | "faviconUrl";

export default function ProfileSection({ formData, handleUpdate, pushToQueue }: any) {
  const safeData = formData || {};
  const [isImageToolOpen, setIsImageToolOpen] = useState(false);
  const [targetImageField, setTargetImageField] = useState<ImageField | null>(null);

  const openImageTool = (field: ImageField) => {
    setTargetImageField(field);
    setIsImageToolOpen(true);
  };

  const handleImageInsert = (url: string) => {
    if (targetImageField) {
      handleUpdate(targetImageField, url);
    }
    setIsImageToolOpen(false);
    setTargetImageField(null);
  };

  const handleSaveAll = () => {
    pushToQueue("个人博客资料", {
      title: safeData.title,
      authorName: safeData.authorName,
      bio: safeData.bio,
      faviconUrl: safeData.faviconUrl,
      avatarUrl: safeData.avatarUrl,
      navTitle: safeData.navTitle,
      navSuffix: safeData.navSuffix,
      navAfter: safeData.navAfter,
      friendLinkApplyFormat: safeData.friendLinkApplyFormat,
      enableLevelSystem: safeData.enableLevelSystem,
    });
  };

  return (
    <>
      <motion.section
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        className="relative rounded-3xl border border-white/50 bg-white/45 p-5 shadow-2xl backdrop-blur-2xl dark:border-slate-800/60 dark:bg-slate-900/45 md:p-7"
      >
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25">
              <User className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Profile</p>
              <h2 className="truncate text-2xl font-black text-slate-900 dark:text-white">站点资料</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-600 active:scale-95"
          >
            <Save className="h-4 w-4" />
            保存资料
          </button>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-white/60 p-5 dark:border-slate-700 dark:bg-slate-800/55">
            <div className="flex flex-col items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.03 }}
                className="h-36 w-36 rounded-3xl border border-white bg-slate-100 p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
              >
                <img
                  src={safeData.avatarUrl || "/siamese-cat.png"}
                  alt="Avatar"
                  className="h-full w-full rounded-[20px] object-cover"
                />
              </motion.div>

              <div className="w-full rounded-2xl bg-slate-50 p-4 text-center dark:bg-slate-900/60">
                <p className="truncate text-base font-black text-slate-900 dark:text-white">
                  {safeData.authorName || "Author"}
                </p>
                <p className="mt-1 truncate text-xs font-bold text-slate-400">
                  {safeData.navTitle || "iV0"} {safeData.navAfter || "Blog"}
                </p>
              </div>

              <div className="grid w-full grid-cols-2 gap-2">
                <ImageButton label="头像" onClick={() => openImageTool("avatarUrl")} />
                <ImageButton label="图标" onClick={() => openImageTool("faviconUrl")} tone="pink" />
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-5">
            <SettingBlock title="品牌与导航">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <TextField
                  label="导航前缀"
                  value={safeData.navTitle || ""}
                  onChange={(value) => handleUpdate("navTitle", value)}
                  placeholder="iV0"
                />
                <TextField
                  label="连接符"
                  value={safeData.navSuffix || ""}
                  onChange={(value) => handleUpdate("navSuffix", value)}
                />
                <TextField
                  label="导航后缀"
                  value={safeData.navAfter || ""}
                  onChange={(value) => handleUpdate("navAfter", value)}
                  placeholder="Blog"
                />
              </div>
            </SettingBlock>

            <SettingBlock title="身份资料">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <TextField
                    label="浏览器标题"
                    value={safeData.title || ""}
                    onChange={(value) => handleUpdate("title", value)}
                    placeholder="iV0 Blog"
                    strong
                  />
                </div>

                <ImageUrlField
                  label="Favicon"
                  value={safeData.faviconUrl || ""}
                  onChange={(value) => handleUpdate("faviconUrl", value)}
                  onOpenTool={() => openImageTool("faviconUrl")}
                  placeholder="/siamese-cat.png"
                />

                <ImageUrlField
                  label="Avatar"
                  value={safeData.avatarUrl || ""}
                  onChange={(value) => handleUpdate("avatarUrl", value)}
                  onOpenTool={() => openImageTool("avatarUrl")}
                  placeholder="/uploads/images/..."
                />

                <div className="md:col-span-2">
                  <TextField
                    label="作者名称"
                    value={safeData.authorName || ""}
                    onChange={(value) => handleUpdate("authorName", value)}
                    strong
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-wide text-slate-400">简介</label>
                  <textarea
                    rows={3}
                    value={safeData.bio || ""}
                    onChange={(event) => handleUpdate("bio", event.target.value)}
                    className="mt-1 w-full resize-none rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                  />
                </div>
              </div>
            </SettingBlock>

            <SettingBlock title="展示扩展">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/60 p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/60">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">等级系统</span>
                    <span className="mt-0.5 text-[10px] text-slate-500">
                      Show achievement and level data in supported blog widgets.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdate("enableLevelSystem", !safeData.enableLevelSystem)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${safeData.enableLevelSystem ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-700"}`}
                  >
                    <span className="sr-only">Toggle level system</span>
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${safeData.enableLevelSystem ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>

                <div>
                  <label className="ml-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                    友链申请格式
                  </label>
                  <textarea
                    rows={4}
                    value={safeData.friendLinkApplyFormat || ""}
                    onChange={(event) => handleUpdate("friendLinkApplyFormat", event.target.value)}
                    placeholder={"Name: iV0 Blog\nDescription: Notes, projects, and moments\nLink: https://your-domain.example\nAvatar: /uploads/images/IMG_20251123_160113-b59a780ebe.png"}
                    className="mt-1 w-full resize-none rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 font-mono text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
                  />
                </div>
              </div>
            </SettingBlock>

            <button
              type="button"
              onClick={handleSaveAll}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-black text-white shadow-xl transition-colors hover:bg-slate-800 active:scale-95 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 md:w-auto"
            >
              <Save className="h-4 w-4" />
              保存站点资料
            </button>
          </div>
        </div>
      </motion.section>

      <FloatingImageTool
        isOpen={isImageToolOpen}
        onClose={() => setIsImageToolOpen(false)}
        onInsert={handleImageInsert}
      />
    </>
  );
}

function SettingBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/55 p-5 dark:border-slate-700 dark:bg-slate-800/55">
      <h3 className="mb-4 border-b border-slate-200 pb-3 text-xs font-black uppercase tracking-widest text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ImageButton({ label, onClick, tone = "indigo" }: { label: string; onClick: () => void; tone?: "indigo" | "pink" }) {
  const className = tone === "pink"
    ? "inline-flex items-center justify-center gap-1.5 rounded-2xl border border-pink-300/50 bg-pink-500/10 px-3 py-2 text-xs font-black text-pink-600 transition-colors hover:bg-pink-500 hover:text-white dark:text-pink-300"
    : "inline-flex items-center justify-center gap-1.5 rounded-2xl border border-indigo-300/50 bg-indigo-500/10 px-3 py-2 text-xs font-black text-indigo-600 transition-colors hover:bg-indigo-500 hover:text-white dark:text-indigo-300";

  return (
    <button type="button" onClick={onClick} className={className}>
      <ImagePlus className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  strong = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  strong?: boolean;
}) {
  return (
    <div>
      <label className="ml-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100 ${strong ? "font-bold" : ""}`}
      />
    </div>
  );
}

function ImageUrlField({
  label,
  value,
  onChange,
  onOpenTool,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onOpenTool: () => void;
  placeholder?: string;
}) {
  return (
    <div className="md:col-span-2">
      <label className="ml-1 flex justify-between text-[10px] font-black uppercase tracking-wide text-slate-400">
        <span>{label}</span>
        {value && <img src={value} alt="" className="h-4 w-4 rounded-full object-cover" />}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={onOpenTool}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-indigo-100 px-4 text-xs font-black text-indigo-600 shadow-sm transition-colors hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/40"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          选择
        </button>
      </div>
    </div>
  );
}
