"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Cpu, KeyRound, MessageSquareText, Save, Sliders, Sparkles } from "lucide-react";
import { fetchBackendJson } from "./backendClient";

const DEFAULT_CONFIG = {
  modelId: "deepseek-chat",
  apiBaseUrl: "https://models.sjtu.edu.cn/api/v1",
  apiKeyEnvName: "DEEPSEEK_API_KEY",
  systemPrompt: "",
  maxOutputTokens: 150,
  temperature: 0.85,
  thinkingStrength: "balanced",
};

const MODEL_PRESETS = ["deepseek-chat", "deepseek-reasoner"];

const THINKING_OPTIONS = [
  { value: "light", label: "轻量", description: "响应更快，适合桌宠闲聊。" },
  { value: "balanced", label: "均衡", description: "速度和质量折中。" },
  { value: "deep", label: "深入", description: "更仔细，适合复杂问题。" },
];

type KeyTarget = {
  path: string;
  exists: boolean;
  hasKey: boolean;
};

type KeyStatus = {
  loading: boolean;
  hasKey: boolean;
  maskedKey?: string;
  envKey?: string;
  targets?: KeyTarget[];
  message?: string;
  tone?: "ok" | "warn" | "error";
};

export default function AICatSection({ formData, handleUpdate, pushToQueue }: any) {
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...(formData.deepseekConfig || {}) }),
    [formData.deepseekConfig],
  );

  const [localPrompt, setLocalPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({
    loading: true,
    hasKey: false,
    message: "正在读取本地密钥状态...",
  });

  useEffect(() => {
    setLocalPrompt(String(config.systemPrompt || "").replace(/\\n/g, "\n"));
  }, [config.systemPrompt]);

  useEffect(() => {
    void loadKeyStatus();
  }, []);

  const updateConfig = (key: string, value: any) => {
    handleUpdate("deepseekConfig", { ...config, [key]: value });
  };

  const handlePromptChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const realText = event.target.value;
    setLocalPrompt(realText);
    updateConfig("systemPrompt", realText);
  };

  const loadKeyStatus = async () => {
    setKeyStatus((prev) => ({ ...prev, loading: true }));

    try {
      const data = await fetchBackendJson("/api/config/deepseek-key/status", { cache: "no-store" });
      if (!data?.success) throw new Error(data?.message || "读取失败");

      setKeyStatus({
        loading: false,
        hasKey: Boolean(data.hasKey),
        maskedKey: data.maskedKey,
        envKey: data.envKey || "DEEPSEEK_API_KEY",
        targets: data.targets || [],
        message: data.hasKey ? "本地已配置 API Key" : "本地还没有配置 API Key",
        tone: data.hasKey ? "ok" : "warn",
      });
    } catch (error: any) {
      setKeyStatus({
        loading: false,
        hasKey: false,
        message: `无法连接本地后端：${error?.message || "请通过 start-manager.bat 启动管理端"}`,
        tone: "error",
      });
    }
  };

  const saveApiKey = async () => {
    const nextKey = apiKey.trim();
    if (!nextKey) {
      setKeyStatus((prev) => ({ ...prev, message: "请先输入 API Key", tone: "warn" }));
      return;
    }

    setSavingKey(true);
    try {
      const data = await fetchBackendJson("/api/config/deepseek-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: nextKey }),
      });

      if (!data?.success) throw new Error(data?.message || "保存失败");

      setApiKey("");
      setKeyStatus({
        loading: false,
        hasKey: true,
        maskedKey: data.maskedKey,
        envKey: data.envKey || "DEEPSEEK_API_KEY",
        targets: (data.targets || []).map((path: string) => ({ path, exists: true, hasKey: true })),
        message: data.message || "API Key 已保存，重启 Next 服务后生效。",
        tone: "ok",
      });
    } catch (error: any) {
      setKeyStatus((prev) => ({
        ...prev,
        loading: false,
        message: `保存失败：${error?.message || "请确认本地 Python 后端已启动"}`,
        tone: "error",
      }));
    } finally {
      setSavingKey(false);
    }
  };

  const statusClass =
    keyStatus.tone === "ok"
      ? "text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
      : keyStatus.tone === "error"
        ? "text-rose-600 dark:text-rose-300 bg-rose-500/10 border-rose-500/20"
        : "text-amber-600 dark:text-amber-300 bg-amber-500/10 border-amber-500/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.28 }}
      className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-white/60 dark:border-slate-800/60 rounded-[32px] p-6 md:p-8 shadow-xl"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-8 pb-6 border-b border-white/40 dark:border-slate-700/50">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3 tracking-tight">
            <Bot className="text-indigo-500" size={28} /> 模型接口配置
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2 flex items-center gap-1.5">
            <Sparkles size={14} className="text-indigo-400" /> 配置 API 地址、模型、Key、Prompt 和思考强度。
          </p>
        </div>
        <button
          type="button"
          onClick={() => pushToQueue("模型接口配置", { deepseekConfig: config })}
          className="px-5 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <Save size={16} /> 暂存模型配置
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <section className="rounded-3xl border border-slate-200/70 dark:border-slate-700/60 bg-white/55 dark:bg-slate-950/35 p-5">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200">
                <KeyRound size={16} className="text-indigo-500" /> API Key
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                密钥只写入本地 .env.local，不会进入 siteConfig 或前台页面。
              </p>
            </div>
            <span className={`text-xs font-black px-3 py-1.5 rounded-xl border ${statusClass}`}>
              {keyStatus.loading ? "检查中" : keyStatus.hasKey ? `已保存 ${keyStatus.maskedKey || ""}` : "未配置"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className="w-full bg-white/80 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/70 rounded-2xl py-3.5 px-5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono text-sm"
              placeholder="sk-..."
              autoComplete="off"
            />
            <button
              type="button"
              onClick={saveApiKey}
              disabled={savingKey}
              className="px-5 py-3.5 bg-slate-900 hover:bg-indigo-600 disabled:opacity-60 disabled:hover:bg-slate-900 dark:bg-white dark:hover:bg-indigo-500 text-white dark:text-slate-950 dark:hover:text-white font-black rounded-2xl transition-colors text-sm"
            >
              {savingKey ? "保存中..." : "保存 Key"}
            </button>
          </div>

          {keyStatus.message && (
            <p className={`mt-3 text-xs font-bold px-3 py-2 rounded-xl border ${statusClass}`}>
              {keyStatus.message}
            </p>
          )}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-300 mb-3">
                <Cpu size={16} className="text-slate-400" /> 模型 API 地址
              </label>
              <input
                type="url"
                value={config.apiBaseUrl}
                onChange={(event) => updateConfig("apiBaseUrl", event.target.value)}
                className="w-full bg-white/55 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl py-3.5 px-5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono text-sm"
                placeholder="https://models.sjtu.edu.cn/api/v1"
              />
              <p className="mt-2 text-[11px] text-slate-400">
                系统会自动拼接 /chat/completions；如果你填完整路径也可以直接使用。
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-300 mb-3">
                <Cpu size={16} className="text-slate-400" /> 模型名称
              </label>
              <input
                type="text"
                value={config.modelId}
                onChange={(event) => updateConfig("modelId", event.target.value)}
                className="w-full bg-white/55 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl py-3.5 px-5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-medium"
                placeholder="例如：deepseek-chat"
              />
              <div className="flex flex-wrap gap-2 mt-3">
                {MODEL_PRESETS.map((model) => (
                  <button
                    key={model}
                    type="button"
                    onClick={() => updateConfig("modelId", model)}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-colors border ${
                      config.modelId === model
                        ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-white/55 dark:bg-slate-900/50 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                    }`}
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-300 mb-3">
              <Sliders size={16} className="text-slate-400" /> 思考强度
            </label>
            <div className="grid grid-cols-3 gap-2">
              {THINKING_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateConfig("thinkingStrength", option.value)}
                  className={`min-h-[82px] rounded-2xl px-2 py-3 border transition-all ${
                    config.thinkingStrength === option.value
                      ? "bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-white/55 dark:bg-slate-950/45 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400"
                  }`}
                >
                  <span className="block text-sm font-black">{option.label}</span>
                  <span className="block mt-1 text-[10px] font-bold opacity-80 leading-tight">{option.description}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div>
          <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-300 mb-3">
            <MessageSquareText size={16} className="text-slate-400" /> 系统 Prompt
          </label>
          <textarea
            value={localPrompt}
            onChange={handlePromptChange}
            className="w-full bg-white/55 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl py-4 px-5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[220px] resize-y font-medium text-sm leading-relaxed custom-scrollbar"
            placeholder="输入 AI 的角色、回复风格和约束..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-300">
                <Sliders size={16} className="text-slate-400" /> 最大回复 Tokens
              </label>
              <span className="text-xs font-black text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded-md">
                {config.maxOutputTokens}
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="2000"
              step="10"
              value={Number(config.maxOutputTokens)}
              onChange={(event) => updateConfig("maxOutputTokens", Number(event.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-300">
                <Sparkles size={16} className="text-slate-400" /> 发散度
              </label>
              <span className="text-xs font-black text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded-md">
                {config.temperature}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={Number(config.temperature)}
              onChange={(event) => updateConfig("temperature", Number(event.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-2">数值越高越灵活，数值越低越稳定。</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
