"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ClipboardList,
  Maximize2,
  Minus,
  RefreshCw,
  Send,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useOperations } from "../context/OperationContext";
import { useToast } from "./ToastProvider";
import { siteConfig } from "../siteConfig";
import { checkBackendHealth, fetchBackend, fetchBackendJson } from "../lib/backendClient";

const navLinks = [
  { name: "首页", href: "/" },
  { name: "写作", href: "/editor" },
  { name: "草稿", href: "/drafts" },
  { name: "项目", href: "/projects" },
  { name: "归档", href: "/timeline" },
  { name: "照片墙", href: "/photowall" },
  { name: "音乐", href: "/music" },
  { name: "说说", href: "/moments" },
  { name: "杂谈", href: "/chatter" },
  { name: "灵境", href: "/tree" },
  { name: "友链", href: "/friends" },
  { name: "关于", href: "/about" },
  { name: "设置", href: "/settings" },
];

const pywebviewStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;

export default function Navbar() {
  const [showNav, setShowNav] = useState(true);
  const [isOpBoxOpen, setIsOpBoxOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [targetBlogPath, setTargetBlogPath] = useState("");
  const [isRunningQueue, setIsRunningQueue] = useState(false);
  const [isSyncingBlog, setIsSyncingBlog] = useState(false);
  const lastScrollYRef = useRef(0);

  const pathname = usePathname();
  const { operations, removeOperation, clearOperations } = useOperations();
  const { showToast } = useToast();
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    const check = () => { checkBackendHealth().then(setBackendOnline); };
    check();
    const timer = setInterval(check, 18_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchPath = async () => {
      try {
        const data = await fetchBackendJson<{ blogPath?: string }>("/api/deploy/config");
        const path = data?.blogPath || localStorage.getItem("targetBlogPath") || "";
        setTargetBlogPath(path);
        if (data?.blogPath) localStorage.setItem("targetBlogPath", data.blogPath);
      } catch {
        setTargetBlogPath(localStorage.getItem("targetBlogPath") || "");
      }
    };

    fetchPath();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setShowNav(!(currentScrollY > lastScrollYRef.current && currentScrollY > 80));
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMinimize = () => {
    if (typeof window !== "undefined" && (window as any).pywebview?.api) {
      (window as any).pywebview.api.minimize_window();
    }
  };

  const handleMaximize = () => {
    if (typeof window !== "undefined" && (window as any).pywebview?.api) {
      (window as any).pywebview.api.maximize_window();
    }
  };

  const handleClose = () => {
    if (typeof window !== "undefined" && (window as any).pywebview?.api) {
      (window as any).pywebview.api.close_window();
    }
  };

  const handleUpdateLocal = async () => {
    if (isRunningQueue) {
      showToast("队列正在执行，请稍等当前任务完成。", "warning");
      return;
    }

    if (operations.length === 0) {
      showToast("队列中没有待处理操作", "warning");
      return;
    }

    setIsRunningQueue(true);

    try {
      showToast(`正在执行 ${operations.length} 个任务...`, "info");

      const configPayload = operations.reduce<Record<string, any>>((payload, op) => {
        if (op.type !== "CONFIG") return payload;
        if (op.payload && typeof op.payload === "object") return { ...payload, ...op.payload };
        if (op.key) return { ...payload, [op.key]: op.value };
        return payload;
      }, {});
      const operationsToRun = operations.filter((op) => op.type !== "CONFIG");

      if (Object.keys(configPayload).length > 0) {
        operationsToRun.unshift({
          id: "merged-config",
          type: "CONFIG",
          label: "配置批量同步",
          description: "合并后的配置写入",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          payload: configPayload,
          value: configPayload,
        });
      }

      for (const op of operationsToRun) {
        let apiPath = "";
        let body = {};

        switch (op.type) {
          case "sync_photowall":
            apiPath = "/api/gallery/sync";
            body = { albums: op.value };
            break;
          case "sync_friends":
            apiPath = "/api/friends/sync";
            body = { friends: op.value };
            break;
          case "sync_projects":
            apiPath = "/api/projects/sync";
            body = { projects: op.value };
            break;
          case "CONFIG":
            apiPath = "/api/config/update";
            body = { updates: op.payload };
            break;
          case "create_moment":
            apiPath = "/api/moments/save";
            body = op.payload;
            break;
          default:
            apiPath = "/api/drafts/sync_local";
            body = { operations: [op] };
            break;
        }

        const res = await fetchBackend(apiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }, 20000);

        const data = await res.json().catch(() => ({}));
        if (!data.success) {
          setIsRunningQueue(false);
          showToast(`任务执行失败：${data.message || "后端返回异常"}`, "error");
          return;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 24));
      }

      showToast("队列已执行，本地数据已更新", "success");
      clearOperations();
      setIsOpBoxOpen(false);

      setIsRunningQueue(false);
    } catch (error: any) {
      setIsRunningQueue(false);
      showToast(`后端连接异常：${error?.message || "请确认管理服务已启动"}`, "error");
    }
  };

  const handleSyncBlogClick = () => {
    const nextPath = targetBlogPath || localStorage.getItem("targetBlogPath") || "";
    if (!nextPath.trim()) {
      showToast("请先在设置 > 部署映射中配置博客项目路径", "warning");
      setIsOpBoxOpen(false);
      return;
    }

    setTargetBlogPath(nextPath);
    setIsOpBoxOpen(false);
    setSyncModalOpen(true);
  };

  const executeSyncBlog = async () => {
    if (isSyncingBlog) {
      showToast("博客同步正在进行，请稍等。", "warning");
      return;
    }

    const blogPath = targetBlogPath.trim();
    if (!blogPath) {
      showToast("请先配置博客项目路径后再同步", "warning");
      return;
    }

    setIsSyncingBlog(true);
    setSyncModalOpen(false);

    try {
      showToast("正在同步到博客项目...", "info");

      const data = await fetchBackendJson<{ success: boolean; message?: string }>("/api/sync/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogPath }),
      }, 120000);

      if (data?.success) {
        showToast(data.message || "博客同步完成", "success");
      } else {
        showToast(`同步失败：${data?.message || "后端未返回成功状态"}`, "error");
      }
      setIsSyncingBlog(false);
    } catch {
      setIsSyncingBlog(false);
      showToast("无法连接 Python 管理服务，请先启动后台", "error");
    }
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[100] w-full border-b backdrop-blur-xl transition-all duration-500 uupm-nav-glass pywebview-drag-region ${
          showNav ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex h-16 w-[95%] max-w-7xl items-center justify-between gap-4 px-4">
          <Link
            href="/"
            style={pywebviewStyle}
            className="flex shrink-0 items-center gap-3 text-xl font-black text-slate-900 transition-colors hover:text-pink-600 dark:text-white dark:hover:text-sky-300"
          >
            <span>
              {siteConfig.navTitle || siteConfig.authorName}
              <span className="ml-1 text-pink-500 dark:text-sky-300">{siteConfig.navAfter || "Blog"}</span>
            </span>
            <span className="uupm-sticker rounded-full px-2.5 py-1 text-[10px] text-pink-600 dark:text-sky-300">
              <span>管理端</span>
            </span>
          </Link>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-4" style={pywebviewStyle}>
            <nav className="hidden min-w-0 flex-1 justify-end gap-4 overflow-x-auto text-xs font-bold xl:flex custom-scrollbar">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname === `${link.href}/`;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative shrink-0 py-1 transition-colors duration-300 ${
                      isActive
                        ? "text-pink-600 dark:text-sky-300"
                        : "text-slate-700 hover:text-pink-600 dark:text-slate-200 dark:hover:text-sky-300"
                    }`}
                  >
                    {link.name}
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-pink-500 dark:bg-sky-300" />
                    )}
                  </Link>
                );
              })}
            </nav>

            <Link
              href="/settings"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/30 bg-white/60 text-slate-700 shadow-sm transition-all hover:scale-105 hover:text-pink-600 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:text-sky-300"
              title="设置"
              aria-label="打开设置"
            >
              <Settings className="h-4 w-4" />
            </Link>

            <span
              className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full transition-colors duration-700 ${
                backendOnline
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                  : "bg-slate-300 dark:bg-slate-600"
              }`}
              title={backendOnline ? "Python 后端已连接" : "Python 后端未连接 — 请运行 start-manager.bat"}
            />

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsOpBoxOpen((value) => !value)}
                className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-white/30 bg-white/60 text-slate-700 shadow-sm transition-all hover:scale-105 hover:text-pink-600 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:text-sky-300"
                title="管理中心"
                aria-label="打开管理中心"
              >
                <ClipboardList className="h-4 w-4" />
                {operations.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-[10px] font-black text-white dark:border-slate-950">
                    {operations.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isOpBoxOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                    transition={{ duration: 0.18 }}
                    className="uupm-card absolute right-0 mt-3 w-[22rem] max-w-[calc(100vw-2rem)] rounded-3xl p-4 shadow-2xl"
                  >
                    <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">管理中心</h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          操作队列、同步和发布都在这里处理。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={clearOperations}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-slate-400 transition-colors hover:text-rose-500 dark:bg-slate-800/70"
                        title="清空队列"
                        aria-label="清空队列"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="relative z-10 mb-4 flex max-h-64 flex-col gap-2 overflow-y-auto custom-scrollbar">
                      {operations.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/50 px-4 py-8 text-center text-sm font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
                          暂无待处理操作
                        </p>
                      ) : (
                        operations.map((op) => (
                          <div
                            key={op.id}
                            className="group flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/55 p-3 dark:border-slate-700/70 dark:bg-slate-900/45"
                          >
                            <div className="min-w-0">
                              <span className="block truncate text-[13px] font-bold text-slate-700 dark:text-slate-200">
                                {op.label}
                              </span>
                              <span className="text-[10px] text-slate-400">{op.timestamp}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeOperation(op.id)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 opacity-70 transition-all hover:bg-rose-500/10 hover:text-rose-500 group-hover:opacity-100"
                              title="移除"
                              aria-label="移除操作"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="relative z-10 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleSyncBlogClick}
                        disabled={isSyncingBlog || isRunningQueue}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-3 py-3 text-xs font-black text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <RefreshCw className="h-4 w-4" />
                        同步博客
                      </button>
                      <button
                        type="button"
                        onClick={handleUpdateLocal}
                        disabled={isRunningQueue || operations.length === 0}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-pink-500 px-3 py-3 text-xs font-black text-white shadow-lg shadow-pink-500/25 transition-colors hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-sky-500 dark:shadow-sky-500/20 dark:hover:bg-sky-600"
                      >
                        <Send className="h-4 w-4" />
                        执行队列
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="hidden items-center gap-2 border-l border-slate-300/50 pl-4 dark:border-slate-600/50 md:flex">
              <button
                type="button"
                onClick={handleMinimize}
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-yellow-400 text-yellow-900 shadow-sm transition-colors hover:bg-yellow-500"
                title="最小化"
                aria-label="最小化窗口"
              >
                <Minus className="h-2.5 w-2.5 opacity-0 transition-opacity hover:opacity-100" />
              </button>
              <button
                type="button"
                onClick={handleMaximize}
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-400 text-green-900 shadow-sm transition-colors hover:bg-green-500"
                title="最大化"
                aria-label="最大化窗口"
              >
                <Maximize2 className="h-2.5 w-2.5 opacity-0 transition-opacity hover:opacity-100" />
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-400 text-red-900 shadow-sm transition-colors hover:bg-red-500"
                title="关闭"
                aria-label="关闭窗口"
              >
                <X className="h-2.5 w-2.5 opacity-0 transition-opacity hover:opacity-100" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {syncModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSyncModalOpen(false)}
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="uupm-card relative w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl"
            >
              <div className="relative z-10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10">
                <AlertTriangle className="text-amber-500" size={32} />
              </div>
              <h3 className="relative z-10 mb-2 text-xl font-black text-slate-900 dark:text-white">
                确认同步到博客
              </h3>
              <p className="relative z-10 mb-8 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                管理端数据将写入目标博客项目：
                <span className="mt-2 block break-all font-bold text-amber-500">{targetBlogPath}</span>
              </p>
              <div className="relative z-10 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSyncModalOpen(false)}
                  className="flex-1 rounded-2xl bg-slate-100 py-4 text-xs font-black text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={executeSyncBlog}
                  disabled={isSyncingBlog}
                  className="flex-1 rounded-2xl bg-amber-500 py-4 text-xs font-black text-white shadow-lg shadow-amber-500/30 transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  确认同步
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
