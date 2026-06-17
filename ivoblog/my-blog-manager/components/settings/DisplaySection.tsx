"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, MonitorCog, Sparkles, Zap } from "lucide-react";

type PerformanceMode = "performance" | "balanced" | "quality";

type EffectsConfig = {
  performanceMode: PerformanceMode;
  enableSplashScreen: boolean;
  enableBackgroundSlider: boolean;
  enableGradientMotion: boolean;
  enableBackgroundEffects: boolean;
  enableHoverEffects: boolean;
  enableDanmaku: boolean;
  enableClickEffect: boolean;
  enableCyberCat: boolean;
  enableFloatingPlayer: boolean;
  enableGlobalToolbox: boolean;
};

type EffectKey = Exclude<keyof EffectsConfig, "performanceMode">;

const DEFAULT_EFFECTS_CONFIG: EffectsConfig = {
  performanceMode: "balanced",
  enableSplashScreen: true,
  enableBackgroundSlider: true,
  enableGradientMotion: false,
  enableBackgroundEffects: false,
  enableHoverEffects: true,
  enableDanmaku: false,
  enableClickEffect: false,
  enableCyberCat: true,
  enableFloatingPlayer: true,
  enableGlobalToolbox: true,
};

const MODE_PRESETS: Record<PerformanceMode, Partial<EffectsConfig>> = {
  performance: {
    performanceMode: "performance",
    enableSplashScreen: false,
    enableBackgroundSlider: true,
    enableGradientMotion: false,
    enableBackgroundEffects: false,
    enableHoverEffects: false,
    enableDanmaku: false,
    enableClickEffect: false,
    enableCyberCat: false,
    enableFloatingPlayer: false,
    enableGlobalToolbox: true,
  },
  balanced: {
    performanceMode: "balanced",
    enableSplashScreen: true,
    enableBackgroundSlider: true,
    enableGradientMotion: false,
    enableBackgroundEffects: false,
    enableHoverEffects: true,
    enableDanmaku: false,
    enableClickEffect: false,
    enableCyberCat: true,
    enableFloatingPlayer: true,
    enableGlobalToolbox: true,
  },
  quality: {
    performanceMode: "quality",
    enableSplashScreen: true,
    enableBackgroundSlider: true,
    enableGradientMotion: true,
    enableBackgroundEffects: true,
    enableHoverEffects: true,
    enableDanmaku: true,
    enableClickEffect: true,
    enableCyberCat: true,
    enableFloatingPlayer: true,
    enableGlobalToolbox: true,
  },
};

const MODE_META: Record<PerformanceMode, { label: string; description: string; icon: typeof Gauge }> = {
  performance: {
    label: "Performance",
    description: "Disable heavy continuous effects and keep reading, editing, music, and sync responsive.",
    icon: Zap,
  },
  balanced: {
    label: "Balanced",
    description: "Keep lightweight polish while avoiding the effects most likely to cause jank.",
    icon: Gauge,
  },
  quality: {
    label: "Quality",
    description: "Enable the richer visual layer for stronger machines.",
    icon: Sparkles,
  },
};

const EFFECT_ITEMS: Array<{ key: EffectKey; title: string; description: string; cost: "Low" | "Medium" | "High" }> = [
  { key: "enableSplashScreen", title: "Splash animation", description: "Show the opening animation.", cost: "Low" },
  { key: "enableBackgroundSlider", title: "Background images", description: "Keep the visual background layer enabled.", cost: "Medium" },
  { key: "enableGradientMotion", title: "Gradient motion", description: "Continuous animated gradient background.", cost: "High" },
  { key: "enableBackgroundEffects", title: "Season effects", description: "Decorative background effects such as petals and ambient layers.", cost: "High" },
  { key: "enableHoverEffects", title: "Hover polish", description: "Card lift, sheen, and hover transitions.", cost: "Medium" },
  { key: "enableDanmaku", title: "Background danmaku", description: "Moving background text layer.", cost: "High" },
  { key: "enableClickEffect", title: "Click particles", description: "Small click particle feedback.", cost: "Medium" },
  { key: "enableCyberCat", title: "AI pet", description: "Desktop pet and assistant entrance.", cost: "Medium" },
  { key: "enableFloatingPlayer", title: "Floating player", description: "Global mini music controller.", cost: "Medium" },
  { key: "enableGlobalToolbox", title: "Global toolbox", description: "Common floating tool shortcuts.", cost: "Low" },
];

export default function DisplaySection({ formData, handleUpdate, pushToQueue, showToast }: any) {
  const [customWidth, setCustomWidth] = useState<number | "">("");
  const [customHeight, setCustomHeight] = useState<number | "">("");

  const effectsConfig = useMemo<EffectsConfig>(
    () => ({ ...DEFAULT_EFFECTS_CONFIG, ...(formData?.effectsConfig || {}) }),
    [formData?.effectsConfig],
  );

  const updateEffects = (next: Partial<EffectsConfig>) => {
    handleUpdate("effectsConfig", { ...effectsConfig, ...next });
  };

  const applyMode = (mode: PerformanceMode) => {
    updateEffects(MODE_PRESETS[mode]);
    showToast?.(`${MODE_META[mode].label} mode saved.`, "success");
  };

  const queueEffects = () => {
    pushToQueue("Effects config", { effectsConfig });
  };

  const applyResolution = async (w: number, h: number) => {
    if (w < 1024 || h < 768) {
      showToast?.("Window size must be at least 1024 x 768.", "error");
      return;
    }

    if (typeof window !== "undefined" && (window as any).pywebview?.api) {
      await (window as any).pywebview.api.resize_window(w, h);
      showToast?.(`Window resized to ${w} x ${h}.`, "success");
    } else {
      showToast?.("Window resizing is only available in the desktop shell.", "warning");
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.22 }}
      className="rounded-[32px] border border-white/50 bg-white/45 p-5 shadow-2xl backdrop-blur-2xl dark:border-slate-800/60 dark:bg-slate-900/45 md:p-7"
    >
      <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-600 dark:text-emerald-300">
            <MonitorCog className="h-3.5 w-3.5" />
            Smoothness Control
          </p>
          <h2 className="text-2xl font-black text-slate-850 dark:text-white">Performance & Effects</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            Changes are saved immediately to both the manager and the blog. Use Performance mode first if the page feels slow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyMode("performance")}
            className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-700 transition-colors hover:bg-emerald-500 hover:text-white dark:text-emerald-300"
          >
            Anti-lag
          </button>
          <button
            type="button"
            onClick={queueEffects}
            className="rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-600"
          >
            Save Effects
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-7 xl:grid-cols-[1fr_340px]">
        <div className="space-y-7">
          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {(["performance", "balanced", "quality"] as const).map((mode) => {
              const meta = MODE_META[mode];
              const Icon = meta.icon;
              const active = effectsConfig.performanceMode === mode;

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => applyMode(mode)}
                  className={`min-h-[116px] rounded-3xl border p-4 text-left transition-all ${
                    active
                      ? "border-indigo-500 bg-indigo-500 text-white shadow-xl shadow-indigo-500/20"
                      : "border-slate-200 bg-white/60 text-slate-700 hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-black">
                    <Icon className="h-4 w-4" />
                    {meta.label}
                  </span>
                  <span className="mt-3 block text-xs font-bold leading-relaxed opacity-80">{meta.description}</span>
                </button>
              );
            })}
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {EFFECT_ITEMS.map((item) => (
              <EffectToggle
                key={item.key}
                title={item.title}
                description={item.description}
                cost={item.cost}
                checked={Boolean(effectsConfig[item.key])}
                onChange={() => updateEffects({ [item.key]: !Boolean(effectsConfig[item.key]) } as Partial<EffectsConfig>)}
              />
            ))}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white/60 p-5 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Manager Window</p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {[
                { name: "2K", w: 2560, h: 1440 },
                { name: "1080P", w: 1920, h: 1080 },
                { name: "MacBook", w: 1440, h: 900 },
                { name: "Safe", w: 1280, h: 800 },
              ].map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyResolution(preset.w, preset.h)}
                  className="rounded-2xl border border-slate-200 bg-white/75 px-3 py-3 text-left transition-colors hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-900/60"
                >
                  <span className="block text-sm font-black text-slate-700 dark:text-slate-200">{preset.name}</span>
                  <span className="mt-1 block font-mono text-[11px] text-slate-400">
                    {preset.w} x {preset.h}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Width"
                value={customWidth}
                onChange={(event) => setCustomWidth(event.target.value ? Number(event.target.value) : "")}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center font-mono text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <span className="font-bold text-slate-400">x</span>
              <input
                type="number"
                placeholder="Height"
                value={customHeight}
                onChange={(event) => setCustomHeight(event.target.value ? Number(event.target.value) : "")}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center font-mono text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (customWidth && customHeight) applyResolution(customWidth, customHeight);
                else showToast?.("Fill both width and height.", "warning");
              }}
              className="mt-3 w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-lg transition-all active:scale-95 dark:bg-white dark:text-slate-950"
            >
              Apply Window Size
            </button>
          </section>

          <section className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5">
            <p className="mb-2 text-sm font-black text-amber-700 dark:text-amber-300">Lag checklist</p>
            <p className="text-xs leading-relaxed text-amber-700/80 dark:text-amber-300/80">
              Disable season effects, danmaku, click particles, gradient motion, AI pet, and the floating player first.
            </p>
          </section>
        </aside>
      </div>
    </motion.section>
  );
}

function EffectToggle({
  title,
  description,
  cost,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  cost: "Low" | "Medium" | "High";
  checked: boolean;
  onChange: () => void;
}) {
  const costClass =
    cost === "High"
      ? "bg-rose-500/10 text-rose-600 dark:text-rose-300"
      : cost === "Medium"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-300"
        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";

  return (
    <button
      type="button"
      onClick={onChange}
      className="flex min-h-[112px] items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white/60 p-4 text-left transition-colors hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-800/60"
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
          {title}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${costClass}`}>{cost}</span>
        </span>
        <span className="mt-2 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      <span className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors ${checked ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-700"}`}>
        <span className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
