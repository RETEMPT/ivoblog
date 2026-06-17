"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Images,
  MessageSquareText,
  Music2,
  Newspaper,
  Palette,
  UserRound,
} from "lucide-react";

type HomeModuleId =
  | "profile"
  | "posts"
  | "theme"
  | "music"
  | "photos"
  | "chatters"
  | "dashboard";

type DockSide = "left" | "right";

export type HomeDockConfig = {
  enabled?: boolean;
  defaultModule?: string;
  left?: string[];
  right?: string[];
  showCenterIcon?: boolean;
  switchOnHover?: boolean;
};

type HomeModule = {
  id: HomeModuleId;
  label: string;
  icon: LucideIcon;
  side: DockSide;
  content: ReactNode;
};

type HomeFocusDockProps = {
  config?: HomeDockConfig;
  profile: ReactNode;
  music: ReactNode;
  posts: ReactNode;
  photos: ReactNode;
  chatters: ReactNode;
  theme: ReactNode;
  dashboard: ReactNode;
};

const MODULE_IDS: HomeModuleId[] = ["profile", "posts", "theme", "music", "photos", "chatters", "dashboard"];
const DEFAULT_LEFT: HomeModuleId[] = ["profile", "posts", "theme"];
const DEFAULT_RIGHT: HomeModuleId[] = ["music", "photos", "chatters", "dashboard"];

const FLOW_COLOR: Record<HomeModuleId, string> = {
  profile: "rgba(236,72,153,0.34)",
  posts: "rgba(125,92,255,0.3)",
  theme: "rgba(34,211,238,0.28)",
  music: "rgba(34,197,94,0.32)",
  photos: "rgba(251,191,36,0.28)",
  chatters: "rgba(96,165,250,0.3)",
  dashboard: "rgba(168,85,247,0.3)",
};

export default function HomeFocusDock({
  config,
  profile,
  music,
  posts,
  photos,
  chatters,
  theme,
  dashboard,
}: HomeFocusDockProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const defaultActiveId = normalizeModuleId(config?.defaultModule) ?? "profile";
  const [activeId, setActiveId] = useState<HomeModuleId>(() => defaultActiveId);
  const showCenterIcon = config?.showCenterIcon !== false;
  const switchOnHover = config?.switchOnHover !== false;

  const contentTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };
  const springTransition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 520, damping: 38, mass: 0.42 };

  const modules = useMemo<HomeModule[]>(
    () => [
      { id: "profile", label: "Profile", icon: UserRound, side: "left", content: profile },
      { id: "posts", label: "Posts", icon: Newspaper, side: "left", content: posts },
      { id: "theme", label: "Theme", icon: Palette, side: "left", content: theme },
      { id: "music", label: "Music", icon: Music2, side: "right", content: music },
      { id: "photos", label: "Photos", icon: Images, side: "right", content: photos },
      { id: "chatters", label: "Notes", icon: MessageSquareText, side: "right", content: chatters },
      { id: "dashboard", label: "Status", icon: Activity, side: "right", content: dashboard },
    ],
    [profile, music, posts, photos, chatters, theme, dashboard],
  );

  const moduleMap = useMemo(() => new Map(modules.map((module) => [module.id, module])), [modules]);
  const dockSides = useMemo(() => resolveDockSides(config), [config]);
  const activeModule = moduleMap.get(activeId) ?? moduleMap.get(defaultActiveId) ?? modules[0];
  const leftModules = dockSides.left.map((id) => moduleMap.get(id)).filter(Boolean) as HomeModule[];
  const rightModules = dockSides.right.map((id) => moduleMap.get(id)).filter(Boolean) as HomeModule[];
  const ActiveIcon = activeModule.icon;

  useEffect(() => {
    if (!moduleMap.has(activeId)) setActiveId(defaultActiveId);
  }, [activeId, defaultActiveId, moduleMap]);

  const setActive = (id: HomeModuleId) => {
    if (id !== activeId) setActiveId(id);
  };

  return (
    <section className="uupm-enter uupm-enter-delay-1 w-full">
      <div className="mb-4 flex gap-3 overflow-x-auto rounded-3xl border border-white/55 bg-white/45 p-2 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/35 lg:hidden">
        {modules.map((module) => (
          <MobileDockButton
            key={module.id}
            module={module}
            active={module.id === activeId}
            onActivate={setActive}
          />
        ))}
      </div>

      <LayoutGroup id="home-focus-dock">
        <div className="grid w-full grid-cols-1 gap-4 overflow-visible lg:grid-cols-[72px_minmax(0,1fr)_72px] lg:gap-5 xl:grid-cols-[80px_minmax(0,1fr)_80px] 2xl:grid-cols-[88px_minmax(0,1fr)_88px] 2xl:gap-6">
          <DockRail
            modules={leftModules}
            activeId={activeId}
            side="left"
            switchOnHover={switchOnHover}
            shouldReduceMotion={shouldReduceMotion}
            onActivate={setActive}
          />

          <div
            className={`relative isolate min-h-[360px] overflow-visible rounded-[32px] sm:min-h-[420px] lg:min-h-[540px] 2xl:min-h-[680px] ${
              showCenterIcon ? "lg:pt-14" : ""
            }`}
            style={{ perspective: 1400 }}
          >
            {showCenterIcon && (
              <AnimatePresence initial={false}>
                <motion.div
                  key={`${activeModule.id}-icon`}
                  layoutId="home-focus-dock-center-icon"
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.84, y: 8 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.92, y: -5 }}
                  transition={springTransition}
                  className="pointer-events-none absolute left-1/2 top-6 z-30 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-white/70 bg-pink-500 text-white shadow-xl shadow-pink-500/25 backdrop-blur-xl dark:border-white/10 lg:grid"
                >
                  <ActiveIcon className="h-5 w-5" strokeWidth={2.4} />
                  <span className="absolute inset-[-4px] -z-10 rounded-[22px] border border-pink-300/30" />
                </motion.div>
              </AnimatePresence>
            )}

            <AnimatePresence initial={false} mode="sync">
              {!shouldReduceMotion && (
                <motion.div
                  key={`${activeModule.id}-flow`}
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 z-10 h-28 w-28 -translate-y-1/2 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${FLOW_COLOR[activeModule.id]} 0%, rgba(255,255,255,0.12) 34%, transparent 72%)`,
                    left: activeModule.side === "left" ? "-2.5rem" : "auto",
                    right: activeModule.side === "right" ? "-2.5rem" : "auto",
                    willChange: "transform, opacity",
                  }}
                  initial={{ opacity: 0.58, scale: 0.22 }}
                  animate={{ opacity: 0, scale: 18 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.54, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </AnimatePresence>

            <AnimatePresence initial={false} mode="sync">
              <motion.div
                key={activeModule.id}
                initial={
                  shouldReduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, scale: 0.985, x: activeModule.side === "left" ? -14 : 14 }
                }
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, x: 0 }}
                exit={
                  shouldReduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, scale: 0.992, x: activeModule.side === "left" ? 10 : -10 }
                }
                transition={contentTransition}
                className="relative z-20 h-full min-h-[360px] sm:min-h-[420px] lg:min-h-[540px] 2xl:min-h-[680px]"
                style={{ transformOrigin: activeModule.side === "left" ? "left center" : "right center" }}
              >
                <div className="h-full min-h-[360px] sm:min-h-[420px] lg:min-h-[540px] 2xl:min-h-[680px] [&>*]:h-full">
                  {activeModule.content}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <DockRail
            modules={rightModules}
            activeId={activeId}
            side="right"
            switchOnHover={switchOnHover}
            shouldReduceMotion={shouldReduceMotion}
            onActivate={setActive}
          />
        </div>
      </LayoutGroup>
    </section>
  );
}

function DockRail({
  modules,
  activeId,
  side,
  switchOnHover,
  shouldReduceMotion,
  onActivate,
}: {
  modules: HomeModule[];
  activeId: HomeModuleId;
  side: DockSide;
  switchOnHover: boolean;
  shouldReduceMotion: boolean;
  onActivate: (id: HomeModuleId) => void;
}) {
  return (
    <div
      className={`sticky top-28 z-40 hidden h-fit min-w-0 flex-col gap-3 lg:flex ${
        side === "right" ? "items-end pr-1" : "items-start pl-1"
      }`}
    >
      {modules.map((module) => (
        <DockButton
          key={module.id}
          module={module}
          active={module.id === activeId}
          side={side}
          switchOnHover={switchOnHover}
          shouldReduceMotion={shouldReduceMotion}
          onActivate={onActivate}
        />
      ))}
    </div>
  );
}

function DockButton({
  module,
  active,
  side,
  switchOnHover,
  shouldReduceMotion,
  onActivate,
}: {
  module: HomeModule;
  active: boolean;
  side: DockSide;
  switchOnHover: boolean;
  shouldReduceMotion: boolean;
  onActivate: (id: HomeModuleId) => void;
}) {
  const Icon = module.icon;
  const buttonTransition = shouldReduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 560, damping: 40, mass: 0.38 };

  return (
    <motion.button
      type="button"
      aria-label={module.label}
      aria-pressed={active}
      title={module.label}
      onMouseEnter={switchOnHover ? () => onActivate(module.id) : undefined}
      onFocus={() => onActivate(module.id)}
      onClick={() => onActivate(module.id)}
      animate={shouldReduceMotion ? undefined : { scale: active ? 1.1 : 1 }}
      whileHover={shouldReduceMotion ? undefined : { scale: active ? 1.12 : 1.07 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
      transition={buttonTransition}
      className={`group relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl border backdrop-blur-xl transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 2xl:h-16 2xl:w-16 ${
        active
          ? "border-pink-300/80 bg-pink-500 text-white shadow-lg shadow-pink-500/25"
          : "border-white/60 bg-white/55 text-slate-700 shadow-sm hover:border-pink-300 hover:text-pink-700 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-200 dark:hover:text-pink-200"
      }`}
    >
      {active && (
        <motion.span
          layoutId={`dock-active-${side}`}
          className="absolute inset-0 rounded-2xl bg-white/10 ring-1 ring-white/35"
          transition={buttonTransition}
        />
      )}
      <Icon className="relative z-10 h-5 w-5 2xl:h-6 2xl:w-6" strokeWidth={2.4} />
      <span
        className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-full border border-white/60 bg-white/90 px-3 py-1 text-xs font-black text-slate-700 opacity-0 shadow-md backdrop-blur-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-white/10 dark:bg-slate-950/90 dark:text-white lg:block ${
          side === "left" ? "left-[calc(100%+0.65rem)]" : "right-[calc(100%+0.65rem)]"
        }`}
      >
        {module.label}
      </span>
    </motion.button>
  );
}

function MobileDockButton({
  module,
  active,
  onActivate,
}: {
  module: HomeModule;
  active: boolean;
  onActivate: (id: HomeModuleId) => void;
}) {
  const Icon = module.icon;

  return (
    <button
      type="button"
      aria-label={module.label}
      aria-pressed={active}
      onClick={() => onActivate(module.id)}
      className={`grid h-12 min-w-12 place-items-center rounded-2xl border transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${
        active
          ? "border-pink-300/80 bg-pink-500 text-white shadow-md shadow-pink-500/25"
          : "border-white/60 bg-white/65 text-slate-700 dark:border-white/10 dark:bg-slate-900/65 dark:text-slate-200"
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={2.4} />
    </button>
  );
}

function normalizeModuleId(id?: string): HomeModuleId | null {
  return MODULE_IDS.includes(id as HomeModuleId) ? (id as HomeModuleId) : null;
}

function resolveDockSides(config?: HomeDockConfig) {
  const used = new Set<HomeModuleId>();
  const left: HomeModuleId[] = [];
  const right: HomeModuleId[] = [];

  const append = (target: HomeModuleId[], ids?: string[]) => {
    for (const rawId of ids || []) {
      const id = normalizeModuleId(rawId);
      if (!id || used.has(id)) continue;
      used.add(id);
      target.push(id);
    }
  };

  append(left, config?.left?.length ? config.left : DEFAULT_LEFT);
  append(right, config?.right?.length ? config.right : DEFAULT_RIGHT);
  append(left, DEFAULT_LEFT);
  append(right, DEFAULT_RIGHT);
  append(right, MODULE_IDS);

  return { left, right };
}
