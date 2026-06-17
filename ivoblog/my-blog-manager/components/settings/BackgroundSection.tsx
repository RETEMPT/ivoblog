import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { useToast } from "../ToastProvider";
import { fetchBackendJson } from "./backendClient";

export default function BackgroundSection({ formData, handleUpdate, pushToQueue }: any) {
  const { showToast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bgImages = Array.isArray(formData.bgImages) ? formData.bgImages : [];

  const removeBg = (index: number) => {
    const nextImages = bgImages.filter((_: string, itemIndex: number) => itemIndex !== index);
    handleUpdate("bgImages", nextImages);
    showToast("背景图已移除。", "success");
  };

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

      if (!data) throw new Error("backend disconnected");
      if (data.success && data.url) {
        setPendingImageUrl(data.url);
        showToast("图片已保存到本地，请确认是否加入背景。", "success");
      } else {
        showToast(`上传失败: ${data.message || "未知错误"}`, "error");
      }
    } catch {
      showToast("无法连接本地 Python 上传通道。", "error");
    } finally {
      setIsUploading(false);
      setIsDragging(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmAddPendingImage = () => {
    if (!pendingImageUrl) return;
    if (bgImages.includes(pendingImageUrl)) {
      showToast("这张图片已经在背景列表里。", "warning");
      setPendingImageUrl(null);
      return;
    }
    handleUpdate("bgImages", [...bgImages, pendingImageUrl]);
    showToast("已加入背景库。", "success");
    setPendingImageUrl(null);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFileUpload(file);
  };

  return (
    <motion.section
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="relative flex flex-col gap-8 overflow-hidden rounded-[32px] border border-white/50 bg-white/40 p-8 shadow-2xl backdrop-blur-2xl dark:border-slate-800/50 dark:bg-slate-900/40"
    >
      <header className="relative z-10 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-800 dark:text-white">
            <ImagePlus className="h-6 w-6 text-indigo-500" />
            视觉背景
          </h2>
          <p className="mt-2 text-[10px] font-bold uppercase text-slate-400">
            本地上传背景图 {bgImages.length} 张
          </p>
        </div>
        <button
          type="button"
          onClick={() => pushToQueue("视觉背景图", "bgImages", bgImages)}
          className="rounded-xl bg-indigo-500 px-6 py-2 text-xs font-black text-white shadow-lg shadow-indigo-500/20 transition active:scale-95"
        >
          保存背景
        </button>
      </header>

      <div className="relative z-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="max-h-[450px] overflow-y-auto rounded-3xl bg-slate-100/50 p-6 custom-scrollbar dark:bg-slate-800/50">
          {bgImages.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              <AnimatePresence>
                {bgImages.map((url: string, index: number) => (
                  <motion.div
                    key={`${url}-${index}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative aspect-video overflow-hidden rounded-2xl border border-white/20 bg-slate-200 shadow-md dark:bg-slate-700"
                  >
                    <img src={url} alt={`background-${index + 1}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => removeBg(index)}
                        className="grid h-10 w-10 scale-90 place-items-center rounded-full bg-red-500 text-white shadow-xl transition hover:bg-red-600 group-hover:scale-100"
                        aria-label="移除背景"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-xs font-bold text-slate-400 dark:border-slate-600">
              暂无背景图
            </div>
          )}
        </div>

        <button
          type="button"
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`relative flex min-h-[260px] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed transition ${
            isDragging
              ? "scale-[1.02] border-indigo-500 bg-indigo-500/10"
              : "border-slate-300 hover:border-indigo-400 hover:bg-slate-100/50 dark:border-slate-600 dark:hover:bg-slate-800/50"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(event) => event.target.files?.[0] && void handleFileUpload(event.target.files[0])}
            className="hidden"
            accept="image/*"
          />
          <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-slate-500 shadow-xl dark:bg-slate-800">
            {isUploading ? <Loader2 className="h-8 w-8 animate-spin text-indigo-500" /> : <UploadCloud className="h-8 w-8" />}
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {isUploading ? "正在上传到本地..." : "点击或拖拽图片到这里"}
          </p>
        </button>
      </div>

      <AnimatePresence>
        {pendingImageUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            className="absolute inset-0 z-50 flex items-center justify-center rounded-[32px] bg-slate-900/45 p-6 backdrop-blur-md"
          >
            <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white p-6 shadow-2xl dark:bg-slate-800">
              <h3 className="mb-4 text-center text-lg font-black text-slate-800 dark:text-white">本地上传完成</h3>
              <div className="mb-6 aspect-video w-full overflow-hidden rounded-xl border border-slate-200 shadow-inner dark:border-slate-700">
                <img src={pendingImageUrl} alt="preview" className="h-full w-full object-cover" />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPendingImageUrl(null)}
                  className="flex-1 rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                >
                  仅上传
                </button>
                <button
                  type="button"
                  onClick={confirmAddPendingImage}
                  className="flex-1 rounded-xl bg-pink-500 py-3 text-xs font-black text-white shadow-lg shadow-pink-500/30 transition hover:bg-pink-600 active:scale-95"
                >
                  加入背景
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
