"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
        className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/50 dark:border-slate-800/50 rounded-[40px] p-8 shadow-2xl relative"
      >
        <div className="flex flex-col md:flex-row gap-12 items-start">
          <div className="relative shrink-0 self-center md:self-start flex flex-col items-center gap-4">
            <motion.div
              whileHover={{ rotate: 0, scale: 1.05 }}
              className="w-40 h-40 rounded-[32px] p-1.5 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-2xl rotate-6 transition-all duration-500"
            >
              <img
                src={safeData.avatarUrl || ""}
                alt="Avatar"
                className="w-full h-full rounded-[26px] object-cover bg-white dark:bg-slate-900 border-2 border-white dark:border-slate-800"
              />
            </motion.div>
            <span className="rounded-full bg-indigo-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
              Personal Blog
            </span>
            <div className="grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openImageTool("avatarUrl")}
                className="rounded-2xl border border-indigo-300/50 bg-indigo-500/10 px-3 py-2 text-xs font-black text-indigo-600 transition-colors hover:bg-indigo-500 hover:text-white dark:text-indigo-300"
              >
                更换头像
              </button>
              <button
                type="button"
                onClick={() => openImageTool("faviconUrl")}
                className="rounded-2xl border border-pink-300/50 bg-pink-500/10 px-3 py-2 text-xs font-black text-pink-600 transition-colors hover:bg-pink-500 hover:text-white dark:text-pink-300"
              >
                站点图标
              </button>
            </div>
          </div>

          <div className="flex-1 w-full space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-1 md:col-span-2 bg-white/30 dark:bg-slate-800/30 p-5 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-sm">
                <div className="md:col-span-3 pb-2 border-b border-slate-200 dark:border-slate-700/50 mb-2">
                  <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Navigation
                  </h3>
                </div>
                <TextField
                  label="Prefix (navTitle)"
                  value={safeData.navTitle || ""}
                  onChange={(value) => handleUpdate("navTitle", value)}
                  placeholder="iV0"
                />
                <TextField
                  label="Connector (navSuffix)"
                  value={safeData.navSuffix || ""}
                  onChange={(value) => handleUpdate("navSuffix", value)}
                />
                <TextField
                  label="Tail (navAfter)"
                  value={safeData.navAfter || ""}
                  onChange={(value) => handleUpdate("navAfter", value)}
                  placeholder="Blog"
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <TextField
                  label="Browser title"
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

              <div className="col-span-1 md:col-span-2">
                <TextField
                  label="Author name"
                  value={safeData.authorName || ""}
                  onChange={(value) => handleUpdate("authorName", value)}
                  strong
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Bio</label>
                <textarea
                  rows={3}
                  value={safeData.bio || ""}
                  onChange={(event) => handleUpdate("bio", event.target.value)}
                  className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm mt-1 outline-none resize-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="col-span-1 md:col-span-2 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-2 block">
                  Display options
                </label>
                <div className="flex items-center justify-between gap-4 p-4 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Level system
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
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
              </div>

              <div className="col-span-1 md:col-span-2 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Friend link apply format
                </label>
                <textarea
                  rows={4}
                  value={safeData.friendLinkApplyFormat || ""}
                  onChange={(event) => handleUpdate("friendLinkApplyFormat", event.target.value)}
                  placeholder={"Name: iV0 Blog\nDescription: Notes, projects, and moments\nLink: https://your-domain.example\nAvatar: /uploads/images/IMG_20251123_160113-b59a780ebe.png"}
                  className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm mt-1 outline-none resize-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveAll}
              className="px-10 py-3 bg-indigo-500 text-white rounded-2xl text-sm font-black shadow-xl hover:bg-indigo-600 transition-all active:scale-95 w-full md:w-auto"
            >
              保存个人资料
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
      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm mt-1 outline-none focus:ring-2 focus:ring-indigo-500 ${strong ? "font-bold" : ""}`}
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
    <div className="col-span-1 md:col-span-2">
      <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex justify-between">
        <span>{label}</span>
        {value && <img src={value} alt="" className="w-4 h-4 rounded-full object-cover" />}
      </label>
      <div className="flex gap-2 mt-1">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={onOpenTool}
          className="px-4 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/40 text-indigo-600 dark:text-indigo-300 rounded-2xl font-black text-xs transition-colors whitespace-nowrap shadow-sm"
        >
          Image
        </button>
      </div>
    </div>
  );
}
