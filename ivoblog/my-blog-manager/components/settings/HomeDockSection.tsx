"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Eye, LayoutDashboard, MousePointer2, RotateCcw, Save } from "lucide-react";

type ModuleId = "profile" | "posts" | "theme" | "music" | "photos" | "chatters" | "dashboard";
type DockSide = "left" | "right";

type HomeDockConfig = {
  enabled: boolean;
  defaultModule: string;
  left: string[];
  right: string[];
  showCenterIcon: boolean;
  switchOnHover: boolean;
};

const MODULES: { id: ModuleId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "posts", label: "Posts" },
  { id: "theme", label: "Theme" },
  { id: "music", label: "Music" },
  { id: "photos", label: "Photos" },
  { id: "chatters", label: "Notes" },
  { id: "dashboard", label: "Status" },
];

const DEFAULT_HOME_DOCK_CONFIG: HomeDockConfig = {
  enabled: true,
  defaultModule: "profile",
  left: ["profile", "posts", "theme"],
  right: ["music", "photos", "chatters", "dashboard"],
  showCenterIcon: true,
  switchOnHover: true,
};

export default function HomeDockSection({ formData, handleUpdate, pushToQueue }: any) {
  const config = useMemo(
    () => normalizeConfig(formData?.homeDockConfig),
    [formData?.homeDockConfig],
  );

  const updateConfig = (patch: Partial<HomeDockConfig>) => {
    handleUpdate("homeDockConfig", normalizeConfig({ ...config, ...patch }));
  };

  const queueConfig = () => {
    pushToQueue("Homepage Dock", { homeDockConfig: config });
  };

  const resetConfig = () => {
    handleUpdate("homeDockConfig", DEFAULT_HOME_DOCK_CONFIG);
  };

  const moveModule = (side: DockSide, id: ModuleId, direction: -1 | 1) => {
    const next = [...config[side]];
    const index = next.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateConfig({ [side]: next } as Partial<HomeDockConfig>);
  };

  const setModuleSide = (id: ModuleId, side: DockSide) => {
    const left = config.left.filter((item) => item !== id);
    const right = config.right.filter((item) => item !== id);
    if (side === "left") left.push(id);
    else right.push(id);
    updateConfig({ left, right });
  };

  return (
    <motion.section
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/50 dark:border-slate-800/50 rounded-[40px] p-6 md:p-8 shadow-2xl"
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <LayoutDashboard className="text-indigo-500" size={28} /> Homepage Dock
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Control the home page side icon dock and its default focus module.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={resetConfig}
            className="px-5 py-3 bg-white/65 dark:bg-slate-800/65 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-black rounded-2xl shadow-sm transition-all text-sm flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} /> Reset
          </button>
          <button
            type="button"
            onClick={queueConfig}
            className="px-5 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-500/25 transition-all text-sm flex items-center justify-center gap-2"
          >
            <Save size={16} /> Queue Dock Config
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ConfigToggle
              icon={<LayoutDashboard size={18} />}
              title="Enable Dock"
              description="Use side icons on desktop and a compact icon bar on mobile."
              checked={config.enabled}
              onChange={() => updateConfig({ enabled: !config.enabled })}
            />
            <ConfigToggle
              icon={<MousePointer2 size={18} />}
              title="Hover Switch"
              description="Desktop icons switch the focus module on hover."
              checked={config.switchOnHover}
              onChange={() => updateConfig({ switchOnHover: !config.switchOnHover })}
            />
            <ConfigToggle
              icon={<Eye size={18} />}
              title="Center Icon"
              description="Show the enlarged active icon above the focus module."
              checked={config.showCenterIcon}
              onChange={() => updateConfig({ showCenterIcon: !config.showCenterIcon })}
            />
          </section>

          <section className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white/55 dark:bg-slate-800/55 p-5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
              Default focus
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {MODULES.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => updateConfig({ defaultModule: module.id })}
                  className={`min-h-[54px] rounded-2xl border px-4 py-3 text-sm font-black transition-all ${
                    config.defaultModule === module.id
                      ? "bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20"
                      : "bg-white/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400"
                  }`}
                >
                  {module.label}
                </button>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <DockLane
              title="Left rail"
              side="left"
              config={config}
              setModuleSide={setModuleSide}
              moveModule={moveModule}
            />
            <DockLane
              title="Right rail"
              side="right"
              config={config}
              setModuleSide={setModuleSide}
              moveModule={moveModule}
            />
          </section>
        </div>

        <aside className="rounded-3xl border border-indigo-500/20 bg-indigo-500/10 p-5 h-fit">
          <p className="text-sm font-black text-indigo-700 dark:text-indigo-300 mb-3">Recommended stable setup</p>
          <div className="space-y-3 text-xs font-bold text-indigo-700/80 dark:text-indigo-200/80 leading-relaxed">
            <p>Keep Dock enabled for the new home layout. Disable it only when you want the classic grid fallback.</p>
            <p>For older devices, turn off Hover Switch first. The buttons will still work with click and keyboard focus.</p>
            <p>All modules stay available even if one side list is incomplete; missing modules are restored automatically.</p>
          </div>
        </aside>
      </div>
    </motion.section>
  );
}

function DockLane({
  title,
  side,
  config,
  setModuleSide,
  moveModule,
}: {
  title: string;
  side: DockSide;
  config: HomeDockConfig;
  setModuleSide: (id: ModuleId, side: DockSide) => void;
  moveModule: (side: DockSide, id: ModuleId, direction: -1 | 1) => void;
}) {
  const ids = config[side].filter(isModuleId);

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white/55 dark:bg-slate-800/55 p-5">
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-4">{title}</h3>
      <div className="space-y-3">
        {ids.map((id, index) => {
          const moduleMeta = MODULES.find((item) => item.id === id);
          if (!moduleMeta) return null;

          return (
            <div key={id} className="flex items-center gap-3 rounded-2xl bg-white/70 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-700 p-3">
              <span className="flex-1 text-sm font-black text-slate-700 dark:text-slate-200">{moduleMeta.label}</span>
              <button
                type="button"
                aria-label={`Move ${moduleMeta.label} up`}
                onClick={() => moveModule(side, id, -1)}
                disabled={index === 0}
                className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 disabled:opacity-30"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                aria-label={`Move ${moduleMeta.label} down`}
                onClick={() => moveModule(side, id, 1)}
                disabled={index === ids.length - 1}
                className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 disabled:opacity-30"
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                onClick={() => setModuleSide(id, side === "left" ? "right" : "left")}
                className="px-3 py-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 text-xs font-black"
              >
                {side === "left" ? "Right" : "Left"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConfigToggle({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex min-h-[118px] items-start justify-between gap-4 rounded-3xl bg-white/55 dark:bg-slate-800/55 border border-slate-200 dark:border-slate-700 p-4 text-left hover:border-indigo-400 transition-colors"
    >
      <span>
        <span className="mb-2 grid h-9 w-9 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
          {icon}
        </span>
        <span className="block text-sm font-black text-slate-800 dark:text-slate-100">{title}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{description}</span>
      </span>
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function normalizeConfig(raw: Partial<HomeDockConfig> | undefined): HomeDockConfig {
  const left = sanitizeModuleList(raw?.left, DEFAULT_HOME_DOCK_CONFIG.left);
  const right = sanitizeModuleList(raw?.right, DEFAULT_HOME_DOCK_CONFIG.right, left);
  const missing = MODULES.map((module) => module.id).filter((id) => !left.includes(id) && !right.includes(id));

  return {
    ...DEFAULT_HOME_DOCK_CONFIG,
    ...(raw || {}),
    enabled: raw?.enabled !== false,
    defaultModule: isModuleId(raw?.defaultModule) ? raw.defaultModule : DEFAULT_HOME_DOCK_CONFIG.defaultModule,
    left,
    right: [...right, ...missing],
    showCenterIcon: raw?.showCenterIcon !== false,
    switchOnHover: raw?.switchOnHover !== false,
  };
}

function sanitizeModuleList(raw: unknown, fallback: string[], used: string[] = []) {
  const source = Array.isArray(raw) && raw.length > 0 ? raw : fallback;
  const seen = new Set(used);
  const result: string[] = [];

  for (const id of source) {
    if (!isModuleId(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }

  return result;
}

function isModuleId(id: unknown): id is ModuleId {
  return MODULES.some((module) => module.id === id);
}
