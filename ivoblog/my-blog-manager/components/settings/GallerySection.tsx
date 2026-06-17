import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, FolderUp, Loader2 } from "lucide-react";
import { useToast } from "../ToastProvider";
import { fetchBackendJson } from "./backendClient";

export default function GallerySection({ handleUpdate, pushToQueue }: any) {
  const { showToast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  const localConfig = {
    picBedName: "Local Upload",
    picBedUrl: "",
    picBedToken: "",
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const data = await fetchBackendJson<{ success: boolean; message?: string }>("/api/picbed/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localConfig),
      });

      if (!data) throw new Error("backend disconnected");
      setTestResult({ success: data.success, msg: data.message || "Local upload mode is ready." });
      showToast(data.success ? "本地上传通道可用。" : "本地上传通道不可用。", data.success ? "success" : "error");
    } catch {
      setTestResult({ success: false, msg: "本地 Python 后端未连接。" });
      showToast("无法连接本地 Python 后端。", "error");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    handleUpdate("picBedName", localConfig.picBedName);
    handleUpdate("picBedUrl", localConfig.picBedUrl);
    handleUpdate("picBedToken", localConfig.picBedToken);
    pushToQueue("本地上传配置", localConfig);
    showToast("已切换为本地上传模式。", "success");
  };

  return (
    <motion.section
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="rounded-[32px] border border-white/50 bg-white/40 p-8 shadow-2xl backdrop-blur-2xl dark:border-slate-800/50 dark:bg-slate-900/40"
    >
      <div className="max-w-xl space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-800 dark:text-white">
            <FolderUp className="h-6 w-6 text-pink-500" />
            图片上传
          </h2>
          <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-400">
            当前使用本地上传：图片保存到管理端和博客端的 public/uploads/images。
          </p>
        </div>

        <div className="rounded-3xl border border-white/45 bg-white/45 p-5 dark:border-white/10 dark:bg-slate-800/45">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <p className="text-sm font-black text-slate-800 dark:text-white">Local Upload</p>
              <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500 dark:text-slate-400">
                不读取外部图床地址，上传成功后返回 /uploads/images/... 本地路径。
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black shadow-lg transition active:scale-95 ${
              isTesting ? "cursor-not-allowed bg-slate-300 text-slate-500" : "bg-pink-500 text-white shadow-pink-500/30 hover:bg-pink-600"
            }`}
          >
            {isTesting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            检查本地通道
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-2xl bg-indigo-500 py-3 text-sm font-black text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600 active:scale-95"
          >
            保存本地模式
          </button>
        </div>

        <AnimatePresence>
          {testResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className={`rounded-2xl border p-4 text-sm font-bold ${
                  testResult.success
                    ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                    : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
              >
                {testResult.msg}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
