"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Copy, ScrollText, Trash2 } from "lucide-react";
import { fetchBackendJson } from "../lib/backendClient";
import { logClientEvent } from "../lib/clientLogger";

type LogMode = "important" | "all";

const IMPORTANT_PATTERNS = [
  "ERROR",
  "WARNING",
  "Traceback",
  "Exception",
  "[client:error]",
  "[client:warning]",
  "/api/config/update",
  "/api/music/login",
  "/api/music/playlist/sync",
  "/api/picbed/upload",
  "/api/sync/execute",
  "/api/deploy/publish",
  "failed",
  "timeout",
  "HTTP 4",
  "HTTP 5",
];

function isImportantLine(line: string) {
  return IMPORTANT_PATTERNS.some((pattern) => line.toLowerCase().includes(pattern.toLowerCase()));
}

function getLineClass(line: string) {
  const lower = line.toLowerCase();
  if (lower.includes("[err]") || lower.includes("error") || lower.includes("exception") || lower.includes("traceback")) {
    return "text-rose-500 dark:text-rose-300";
  }
  if (lower.includes("warning") || lower.includes("warn") || lower.includes("timeout")) {
    return "text-amber-500 dark:text-amber-300";
  }
  if (lower.includes("200 ok") || lower.includes("saved") || lower.includes("success")) {
    return "text-emerald-600 dark:text-emerald-300";
  }
  return "text-slate-600 dark:text-slate-300";
}

export default function LogViewer() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [followTail, setFollowTail] = useState(true);
  const [mode, setMode] = useState<LogMode>("important");
  const cursorRef = useRef(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const visibleLines = useMemo(
    () => (mode === "important" ? lines.filter(isImportantLine) : lines),
    [lines, mode],
  );

  const fetchLogs = useCallback(async () => {
    const data = await fetchBackendJson<{ lines: string[]; cursor: number }>(
      `/api/logs/recent?limit=240&after=${cursorRef.current}`,
      undefined,
      4000,
    );

    if (data?.lines?.length) {
      setLines((prev) => [...prev.slice(-520), ...data.lines].slice(-600));
      cursorRef.current = data.cursor;
    }
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const stopFollowing = useCallback(() => {
    setFollowTail(false);
  }, []);

  const handleScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distanceToBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    setFollowTail(distanceToBottom < 24);
  }, []);

  const copyLogs = async () => {
    const target = visibleLines.length > 0 ? visibleLines : lines;
    try {
      await navigator.clipboard?.writeText(target.join("\n"));
      logClientEvent("info", "LogViewer", `Copied ${target.length} log lines`);
    } catch (error) {
      logClientEvent("warning", "LogViewer", "Copy logs failed", error);
    }
  };

  const clearLogs = async () => {
    setLines([]);
    cursorRef.current = -1;
    await fetchBackendJson("/api/logs/clear", { method: "POST" }, 4000);
  };

  useEffect(() => {
    if (!open) return;

    const fetchVisibleLogs = () => {
      if (!document.hidden) void fetchLogs();
    };

    void fetchLogs();
    timerRef.current = setInterval(fetchVisibleLogs, 2500);
    document.addEventListener("visibilitychange", fetchVisibleLogs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", fetchVisibleLogs);
    };
  }, [open, fetchLogs]);

  useEffect(() => {
    if (open && followTail) {
      scrollToBottom("auto");
    }
  }, [visibleLines.length, open, followTail, scrollToBottom]);

  return (
    <div className="fixed bottom-4 left-4 z-[9999] flex flex-col items-start gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="uupm-card flex max-h-[380px] w-[480px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl shadow-2xl"
          >
            <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/40 px-4 py-3 text-xs text-slate-500 dark:border-slate-700/70 dark:text-slate-400">
              <div className="min-w-0">
                <div className="font-black text-slate-800 dark:text-slate-100">运行日志</div>
                <div className="mt-0.5 truncate">
                  {followTail ? "正在跟随最新日志" : "已暂停跟随，可停留选择并复制"}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMode((value) => (value === "important" ? "all" : "important"))}
                  className="rounded-full bg-white/70 px-3 py-2 text-[11px] font-black text-slate-500 transition-colors hover:text-pink-600 dark:bg-slate-800/70 dark:hover:text-sky-300"
                  title="切换日志范围"
                >
                  {mode === "important" ? "关键" : "全部"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFollowTail(true);
                    requestAnimationFrame(() => scrollToBottom("smooth"));
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-slate-500 transition-colors hover:text-pink-600 dark:bg-slate-800/70 dark:hover:text-sky-300"
                  title="滚动到底部"
                  aria-label="滚动到底部"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={copyLogs}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-slate-500 transition-colors hover:text-pink-600 dark:bg-slate-800/70 dark:hover:text-sky-300"
                  title="复制当前日志"
                  aria-label="复制当前日志"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={clearLogs}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-slate-500 transition-colors hover:text-rose-500 dark:bg-slate-800/70"
                  title="清空日志"
                  aria-label="清空日志"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              onWheel={stopFollowing}
              onPointerDown={stopFollowing}
              className="custom-scrollbar relative z-10 flex-1 select-text space-y-0.5 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
            >
              {visibleLines.length === 0 && (
                <p className="text-slate-400">暂无关键日志。切换到“全部”可查看原始记录。</p>
              )}
              {visibleLines.map((line, index) => (
                <div key={`${index}-${line}`} className={getLineClass(line)}>
                  <span className="whitespace-pre-wrap break-words">{line}</span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/30 shadow-lg backdrop-blur-md transition-all hover:scale-110 active:scale-95 ${
          open
            ? "bg-pink-500 text-white dark:bg-sky-500"
            : "bg-white/70 text-slate-500 dark:bg-slate-900/70 dark:text-slate-300"
        }`}
        title="运行日志"
        aria-label="打开运行日志"
      >
        <ScrollText className="h-5 w-5" />
      </button>
    </div>
  );
}
