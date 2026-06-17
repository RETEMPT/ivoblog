"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { siteConfig } from "../siteConfig";

const BackgroundEffects = dynamic(() => import("./BackgroundEffects"), { ssr: false });
const DanmakuBackground = dynamic(() => import("./DanmakuBackground"), { ssr: false });
const FloatingPlayer = dynamic(() => import("./FloatingPlayer"), { ssr: false });
const ClickEffect = dynamic(() => import("./ClickEffect"), { ssr: false });
const CyberCat = dynamic(() => import("./CyberCat"), { ssr: false });

const defaultEffectsConfig = {
  performanceMode: "balanced",
  enableBackgroundEffects: false,
  enableDanmaku: false,
  enableClickEffect: false,
  enableCyberCat: true,
  enableFloatingPlayer: true,
};

const effectsConfig = {
  ...defaultEffectsConfig,
  ...(siteConfig.effectsConfig as Partial<typeof defaultEffectsConfig> | undefined),
};

function warmEffectModules() {
  if (effectsConfig.performanceMode === "performance") return;
  if (effectsConfig.enableBackgroundEffects) void import("./BackgroundEffects");
  if (effectsConfig.enableFloatingPlayer) void import("./FloatingPlayer");
  if (effectsConfig.enableClickEffect) void import("./ClickEffect");
  if (effectsConfig.enableCyberCat) void import("./CyberCat");
  if (effectsConfig.enableDanmaku) void import("./DanmakuBackground");
}

type NavigatorHints = Navigator & {
  connection?: { saveData?: boolean; effectiveType?: string };
  mozConnection?: { saveData?: boolean; effectiveType?: string };
  webkitConnection?: { saveData?: boolean; effectiveType?: string };
  deviceMemory?: number;
};

function readLowPowerHint() {
  if (typeof navigator === "undefined") return false;

  const nav = navigator as NavigatorHints;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  const effectiveType = connection?.effectiveType || "";
  const saveData = Boolean(connection?.saveData);
  const slowNetwork = effectiveType === "slow-2g" || effectiveType === "2g";
  const lowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2;
  const veryLowCoreCount = typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 1;

  return saveData || slowNetwork || lowMemory || veryLowCoreCount;
}

function usePerformanceGate(delay = 1000) {
  const [enabled, setEnabled] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [lowPower, setLowPower] = useState(false);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timeoutId: number | undefined;
    let idleId: number | undefined;
    let preloadTimeoutId: number | undefined;
    let preloadIdleId: number | undefined;

    const sync = () => {
      setDesktop(desktopQuery.matches);
      setReduceMotion(motionQuery.matches);
      const shouldReduce = readLowPowerHint();
      setLowPower(shouldReduce);
      document.documentElement.classList.toggle("effects-reduced-auto", shouldReduce);
    };

    sync();
    desktopQuery.addEventListener("change", sync);
    motionQuery.addEventListener("change", sync);

    const arm = () => setEnabled(true);
    const idleWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleId = idleWindow.requestIdleCallback(arm, { timeout: delay + 1200 });
    } else {
      timeoutId = window.setTimeout(arm, delay);
    }

    const canPreload =
      effectsConfig.performanceMode !== "performance" &&
      desktopQuery.matches &&
      !motionQuery.matches &&
      !readLowPowerHint();

    if (canPreload) {
      if (typeof idleWindow.requestIdleCallback === "function") {
        preloadIdleId = idleWindow.requestIdleCallback(warmEffectModules, { timeout: delay + 2600 });
      } else {
        preloadTimeoutId = window.setTimeout(warmEffectModules, delay + 1600);
      }
    }

    return () => {
      desktopQuery.removeEventListener("change", sync);
      motionQuery.removeEventListener("change", sync);
      if (idleId && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
      if (preloadIdleId && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(preloadIdleId);
      }
      if (preloadTimeoutId) window.clearTimeout(preloadTimeoutId);
      document.documentElement.classList.remove("effects-reduced-auto");
    };
  }, [delay]);

  return enabled && desktop && !reduceMotion && !lowPower;
}

export function PerformanceBackgroundEffects() {
  const pathname = usePathname();
  const delay = effectsConfig.performanceMode === "quality" ? 700 : 1500;
  const canRun = usePerformanceGate(delay);

  if (!effectsConfig.enableBackgroundEffects || effectsConfig.performanceMode === "performance") return null;
  if (!canRun || pathname !== "/") return null;

  return (
    <div className="absolute inset-0 hidden lg:block">
      <BackgroundEffects />
    </div>
  );
}

export function PerformanceWidgets() {
  const delay = effectsConfig.performanceMode === "quality" ? 900 : 1700;
  const canRun = usePerformanceGate(delay);

  if (!canRun) return null;

  return (
    <>
      {effectsConfig.enableFloatingPlayer && <FloatingPlayer />}
      {effectsConfig.enableClickEffect && effectsConfig.performanceMode !== "performance" && <ClickEffect />}
      {effectsConfig.enableCyberCat && <CyberCat />}
      {effectsConfig.enableDanmaku && effectsConfig.performanceMode !== "performance" && <DanmakuBackground />}
    </>
  );
}
