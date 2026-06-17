"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { useToast } from "../ToastProvider";
import { fetchBackendJson } from "../../lib/backendClient";

interface FloatingImageToolProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (url: string) => void;
}

export default function FloatingImageTool({ isOpen, onClose, onInsert }: FloatingImageToolProps) {
  const { showToast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("只能上传图片文件。", "warning");
      return;
    }

    setIsUploading(true);
    showToast("正在保存到本地上传目录...", "info");

    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("url", "");
      uploadData.append("token", "local-fallback");

      const data = await fetchBackendJson<{ success: boolean; url?: string; message?: string }>("/api/picbed/upload", {
        method: "POST",
        body: uploadData,
      });

      if (data?.success && data.url) {
        setUploadedUrl(data.url);
        showToast("图片已保存到本地。", "success");
      } else {
        showToast(`上传失败: ${data?.message || "本地后端未连接"}`, "error");
      }
    } catch (error: any) {
      showToast(`连接异常: ${error.message || "请确认 Python 后端已启动"}`, "error");
    } finally {
      setIsUploading(false);
      setIsDragging(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFileUpload(file);
  };

  const copyUrlToClipboard = async () => {
    if (!uploadedUrl) return;
    try {
      await navigator.clipboard.writeText(uploadedUrl);
      showToast("本地图片路径已复制。", "success");
    } catch {
      showToast("复制失败，请手动选中路径。", "warning");
    }
  };

  const resetUpload = () => setUploadedUrl("");

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          drag
          dragMomentum={false}
          dragElastic={0}
          initial={{ opacity: 0, scale: 0.96, y: -16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          style={{ position: "fixed", top: "15vh", right: "5vw", zIndex: 99999 }}
          className="w-80 cursor-move overflow-hidden rounded-[28px] border border-white/50 bg-white/55 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/60"
        >
          <div className="flex items-center justify-between border-b border-white/35 bg-white/45 p-5 dark:border-white/10 dark:bg-slate-800/45">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
              <ImagePlus className="h-5 w-5 text-emerald-500" />
              本地图片
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/60 text-slate-500 shadow-sm transition hover:bg-red-500 hover:text-white dark:bg-slate-700/60"
              aria-label="关闭"
            >
              <X size={16} />
            </button>
          </div>

          <div className="cursor-default bg-white/20 p-6 dark:bg-slate-900/20">
            {!uploadedUrl ? (
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`flex h-40 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition ${
                  isDragging
                    ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-900/30"
                    : "border-slate-300/80 hover:bg-white/60 dark:border-slate-600/80 dark:hover:bg-slate-800/60"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(event) => event.target.files?.[0] && void handleFileUpload(event.target.files[0])}
                  accept="image/*"
                  className="hidden"
                />
                {isUploading ? (
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                ) : (
                  <UploadCloud className="h-10 w-10 text-slate-400" />
                )}
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {isUploading ? "正在上传..." : "点击或拖拽图片上传"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={resetUpload}
                  className="group relative flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/45 bg-white/45 p-2 shadow-inner dark:border-slate-700/50 dark:bg-slate-950/40"
                >
                  <img src={uploadedUrl} alt="preview" className="max-h-full max-w-full rounded-xl object-contain" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100">
                    重新选择
                  </span>
                </button>

                <div className="rounded-2xl bg-slate-950/5 px-3 py-2 text-[11px] font-bold text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  {uploadedUrl}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={copyUrlToClipboard}
                    className="flex items-center justify-center gap-2 rounded-xl bg-white/65 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-white dark:bg-slate-800/65 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Copy size={14} />
                    复制
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onInsert(uploadedUrl);
                      setUploadedUrl("");
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-600 active:scale-95"
                  >
                    <Check size={14} />
                    插入
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
