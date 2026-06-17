"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useOperations } from "../../context/OperationContext";
import { siteConfig } from "../../siteConfig";
import Navbar from "../../components/Navbar";
import PageTransition from "../../components/PageTransition";
import { ToastProvider, useToast } from "../../components/ToastProvider";
import ProfileSection from "../../components/settings/ProfileSection";
import BackgroundSection from "../../components/settings/BackgroundSection";
import MusicSection from "../../components/settings/MusicSection";
import GallerySection from "../../components/settings/GallerySection";
import RepoSection from "../../components/settings/RepoSection";
import DisplaySection from "../../components/settings/DisplaySection";
import HomeDockSection from "../../components/settings/HomeDockSection";
import CommentSection from "../../components/settings/CommentSection";
import DanmakuSection from "../../components/settings/DanmakuSection";
import FooterSection from "../../components/settings/FooterSection";
import AICatSection from "../../components/settings/AICatSection";
import { fetchBackendJson } from "../../lib/backendClient";
import { normalizeLocalAssetList, normalizeLocalAssetPath } from "../../lib/localMedia";

const MAX_MUSIC_IDS = 50;

const DEFAULT_EFFECTS_CONFIG = {
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

const DEFAULT_HOME_DOCK_CONFIG = {
  enabled: true,
  defaultModule: "profile",
  left: ["profile", "posts", "theme"],
  right: ["music", "photos", "chatters", "dashboard"],
  showCenterIcon: true,
  switchOnHover: true,
};

const SETTINGS_MENU_ITEMS = [
  { id: "homeDock", name: "Home Dock", icon: "Dock" },
  { id: "profile", name: "Profile", icon: "User" },
  { id: "display", name: "Effects", icon: "Perf" },
  { id: "background", name: "Background", icon: "Bg" },
  { id: "music", name: "Music", icon: "Music" },
  { id: "gallery", name: "Gallery", icon: "Gallery" },
  { id: "footer", name: "Footer", icon: "Footer" },
  { id: "danmaku", name: "Danmaku", icon: "Text" },
  { id: "comment", name: "Comments", icon: "Chat" },
  { id: "aicat", name: "AI/API", icon: "AI" },
  { id: "repo", name: "Deploy", icon: "Repo" },
];

const CONFIG_UPDATE_KEYS = [
  "title",
  "authorName",
  "bio",
  "faviconUrl",
  "avatarUrl",
  "navTitle",
  "navSuffix",
  "navAfter",
  "useGradient",
  "themeColors",
  "bgImages",
  "defaultPostCover",
  "photoWallImage",
  "cloudMusicIds",
  "musicPlaybackMode",
  "effectsConfig",
  "homeDockConfig",
  "chatterTitle",
  "chatterDescription",
  "picBedName",
  "picBedUrl",
  "picBedToken",
  "danmakuList",
  "gitalkConfig",
  "buildDate",
  "footerBadges",
  "icpConfig",
  "deepseekConfig",
  "friendLinkApplyFormat",
  "enableLevelSystem",
];

function normalizeMusicIds(value: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map(String)
        .filter((id) => /^\d{3,}$/.test(id)),
    ),
  ).slice(0, MAX_MUSIC_IDS);
}

function normalizeConfigValue(field: string, value: any) {
  if (field === "cloudMusicIds") return normalizeMusicIds(value);
  if (field === "avatarUrl" || field === "faviconUrl" || field === "defaultPostCover" || field === "photoWallImage") {
    return normalizeLocalAssetPath(value, "");
  }
  if (field === "bgImages") return normalizeLocalAssetList(value, []);
  return value;
}

function pickConfigPayload(data: Record<string, any>) {
  return CONFIG_UPDATE_KEYS.reduce((payload, key) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      payload[key] = normalizeConfigValue(key, data[key]);
    }
    return payload;
  }, {} as Record<string, any>);
}

function createInitialFormData() {
  return {
    title: siteConfig.title || "",
    authorName: siteConfig.authorName || "",
    bio: siteConfig.bio || "",
    faviconUrl: normalizeConfigValue("faviconUrl", siteConfig.faviconUrl || ""),
    avatarUrl: normalizeConfigValue("avatarUrl", siteConfig.avatarUrl || ""),
    navTitle: siteConfig.navTitle || "",
    navSuffix: siteConfig.navSuffix || "",
    navAfter: siteConfig.navAfter || "",
    useGradient: Boolean(siteConfig.useGradient),
    themeColors: [...(siteConfig.themeColors || [])],
    defaultPostCover: normalizeConfigValue("defaultPostCover", siteConfig.defaultPostCover || ""),
    photoWallImage: normalizeConfigValue("photoWallImage", siteConfig.photoWallImage || ""),
    cloudMusicIds: normalizeMusicIds(siteConfig.cloudMusicIds || []),
    musicPlaybackMode: (siteConfig as any).musicPlaybackMode === "local" ? "local" : "cloud",
    bgImages: normalizeConfigValue("bgImages", siteConfig.bgImages || []),
    effectsConfig: { ...DEFAULT_EFFECTS_CONFIG, ...(siteConfig.effectsConfig || {}) },
    homeDockConfig: { ...DEFAULT_HOME_DOCK_CONFIG, ...(siteConfig.homeDockConfig || {}) },
    gitalkConfig: siteConfig.gitalkConfig || { clientID: "", clientSecret: "", repo: "", owner: "", admin: [] },
    danmakuList: [...(siteConfig.danmakuList || [])],
    buildDate: siteConfig.buildDate || "2026-06-13T00:00:00",
    icpConfig: siteConfig.icpConfig || { name: "", link: "" },
    footerBadges: [...(siteConfig.footerBadges || [])],
    friendLinkApplyFormat: siteConfig.friendLinkApplyFormat || "",
    enableLevelSystem: siteConfig.enableLevelSystem !== false,
    deepseekConfig: siteConfig.deepseekConfig || {
      modelId: "deepseek-chat",
      apiBaseUrl: "https://models.sjtu.edu.cn/api/v1",
      apiKeyEnvName: "DEEPSEEK_API_KEY",
      systemPrompt: "",
      maxOutputTokens: 150,
      temperature: 0.85,
      thinkingStrength: "balanced",
    },
    newMusicId: "",
  };
}

function SettingsContent() {
  const { addOperation } = useOperations();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("homeDock");
  const [formData, setFormData] = useState<any>(createInitialFormData);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [musicDetails, setMusicDetails] = useState<Record<string, any>>({});
  const requestedMusicIdsRef = useRef<Set<string>>(new Set());
  const saveTimersRef = useRef<Record<string, number>>({});

  const saveConfigPayload = useCallback(async (label: string, payload: Record<string, any>, quiet = false) => {
    const updates = pickConfigPayload(payload);
    if (Object.keys(updates).length === 0) return false;

    const data = await fetchBackendJson(
      "/api/config/update",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      },
      12000,
    );

    if (!data?.success) {
      showToast(data?.message || `${label} save failed. Start the local backend and try again.`, "error");
      return false;
    }

    if (!quiet) showToast(`${label} saved.`, "success");
    return true;
  }, [showToast]);

  const scheduleConfigSave = useCallback((field: string, value: any) => {
    if (!CONFIG_UPDATE_KEYS.includes(field)) return;
    const delay = typeof value === "string" ? 550 : 0;

    if (saveTimersRef.current[field]) {
      window.clearTimeout(saveTimersRef.current[field]);
    }

    saveTimersRef.current[field] = window.setTimeout(() => {
      void saveConfigPayload(field, { [field]: value }, true);
      delete saveTimersRef.current[field];
    }, delay);
  }, [saveConfigPayload]);

  const handleUpdate = useCallback((field: string, value: any) => {
    const normalizedValue = normalizeConfigValue(field, value);
    setFormData((prev: any) => ({ ...prev, [field]: normalizedValue }));
    // No auto-save — user must explicitly save via the "Save" button or Navbar queue
  }, []);

  const pushToQueue = useCallback((label: string, keyOrPayload?: string | Record<string, any>, value?: any) => {
    const isSingleKey = typeof keyOrPayload === "string";
    const payload = isSingleKey
      ? { [keyOrPayload]: value }
      : keyOrPayload
        ? pickConfigPayload(keyOrPayload)
        : pickConfigPayload(formData);

    void saveConfigPayload(label, payload);
    addOperation({
      id: Date.now().toString(),
      type: "CONFIG",
      label: `Saved config: ${label}`,
      description: `${label} was written to manager and blog siteConfig.ts.`,
      timestamp: new Date().toLocaleTimeString().slice(0, 5),
      payload,
      key: isSingleKey ? keyOrPayload : undefined,
      value: isSingleKey ? value : payload,
    });
  }, [addOperation, formData, saveConfigPayload]);

  const configLoadedRef = useRef(false);

  useEffect(() => {
    if (configLoadedRef.current) return;  // never re-fetch — user edits would be overwritten

    let cancelled = false;
    const fetchRealConfig = async () => {
      const data = await fetchBackendJson("/api/config/get", undefined, 8000);
      if (cancelled) return;
      if (!data?.success || !data.data) {
        showToast("Local Python backend is not connected. Start manager first.", "warning");
        return;
      }

      configLoadedRef.current = true;
      setFormData((prev: any) => ({
        ...prev,
        ...data.data,
        faviconUrl: normalizeConfigValue("faviconUrl", data.data.faviconUrl ?? prev.faviconUrl),
        avatarUrl: normalizeConfigValue("avatarUrl", data.data.avatarUrl ?? prev.avatarUrl),
        defaultPostCover: normalizeConfigValue("defaultPostCover", data.data.defaultPostCover ?? prev.defaultPostCover),
        photoWallImage: normalizeConfigValue("photoWallImage", data.data.photoWallImage ?? prev.photoWallImage),
        bgImages: normalizeConfigValue("bgImages", data.data.bgImages ?? prev.bgImages),
        cloudMusicIds: normalizeMusicIds(data.data.cloudMusicIds || prev.cloudMusicIds),
        musicPlaybackMode: data.data.musicPlaybackMode === "local" ? "local" : "cloud",
        effectsConfig: { ...DEFAULT_EFFECTS_CONFIG, ...(prev.effectsConfig || {}), ...(data.data.effectsConfig || {}) },
        homeDockConfig: { ...DEFAULT_HOME_DOCK_CONFIG, ...(prev.homeDockConfig || {}), ...(data.data.homeDockConfig || {}) },
        gitalkConfig: { ...(prev.gitalkConfig || {}), ...(data.data.gitalkConfig || {}) },
        danmakuList: data.data.danmakuList ? [...data.data.danmakuList] : prev.danmakuList,
        footerBadges: data.data.footerBadges ? [...data.data.footerBadges] : prev.footerBadges,
        deepseekConfig: { ...(prev.deepseekConfig || {}), ...(data.data.deepseekConfig || {}) },
      }));
    };

    void fetchRealConfig();
    return () => { cancelled = true; };
  }, [showToast]);

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      saveTimersRef.current = {};
    };
  }, []);

  const fetchMusicDetail = async (id: string) => {
    const data = await fetchBackendJson(`/api/music/query/${id}`, undefined, 8000);
    return data?.success ? data.data : { error: true, id, name: "Music backend unavailable" };
  };

  useEffect(() => {
    let cancelled = false;
    const ids = normalizeMusicIds(formData.cloudMusicIds)
      .filter((id) => !musicDetails[id] && !requestedMusicIdsRef.current.has(id));
    if (ids.length === 0) return;

    ids.forEach((id) => requestedMusicIdsRef.current.add(id));
    const timer = window.setTimeout(async () => {
      const details: Record<string, any> = {};
      for (let start = 0; start < ids.length; start += 30) {
        const chunk = ids.slice(start, start + 30);
        const data = await fetchBackendJson(`/api/music/batch?ids=${encodeURIComponent(chunk.join(","))}`, undefined, 12000);
        const songs = Array.isArray(data?.songs) ? data.songs : [];
        for (const song of songs) {
          if (!song?.id) continue;
          details[String(song.id)] = {
            id: String(song.id),
            name: song.name || song.title || `NetEase Song ${song.id}`,
            artist: song.artist || song.author || "",
            album: song.album || "",
            cover: song.cover || song.pic || "",
            fallback: Boolean(song.fallback),
          };
        }
        for (const id of chunk) {
          if (!details[id]) {
            details[id] = { id, name: `NetEase Song ${id}`, artist: "Details unavailable", fallback: true };
          }
        }
      }
      if (!cancelled) setMusicDetails((prev) => ({ ...prev, ...details }));
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [formData.cloudMusicIds, musicDetails]);

  const queryMusic = async () => {
    const id = String(formData.newMusicId || "").trim();
    if (!/^\d{3,}$/.test(id)) {
      showToast("Enter a valid NetEase song ID.", "warning");
      return;
    }

    setQueryLoading(true);
    setQueryResult(null);
    const info = await fetchMusicDetail(id);
    if (info && !info.error) {
      setQueryResult(info);
      showToast("Song info loaded.", "success");
    } else {
      showToast(info?.name || "Song was not found.", "error");
    }
    setQueryLoading(false);
  };

  const removeSong = (index: number) => {
    const newList = normalizeMusicIds(formData.cloudMusicIds);
    newList.splice(index, 1);
    handleUpdate("cloudMusicIds", newList);
    showToast("Song removed.", "success");
  };

  const confirmAddMusic = () => {
    if (!queryResult) return;
    const targetId = String(queryResult.id);
    const current = normalizeMusicIds(formData.cloudMusicIds);
    if (current.includes(targetId)) {
      showToast(`${queryResult.name} is already in the playlist.`, "warning");
      return;
    }
    const next = [...current, targetId].slice(0, MAX_MUSIC_IDS);
    handleUpdate("cloudMusicIds", next);
    setMusicDetails((prev) => ({ ...prev, [targetId]: queryResult }));
    setQueryResult(null);
    handleUpdate("newMusicId", "");
    showToast("Song added.", "success");
  };

  return (
    <div className="min-h-screen relative pb-10">
      <Navbar />
      <PageTransition>
        <main className="w-[95%] max-w-7xl mx-auto mt-24 flex flex-col md:flex-row gap-8 items-start relative z-10">
          <aside className="w-full md:w-72 shrink-0 flex flex-col gap-4">
            <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-3xl p-4 shadow-xl">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-4 ml-2 tracking-widest">Settings</p>
              <nav className="flex flex-col gap-2">
                {SETTINGS_MENU_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 font-bold text-sm ${
                      activeTab === item.id
                        ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 translate-x-1"
                        : "text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="min-w-10 text-[10px] font-black uppercase opacity-80">{item.icon}</span>
                    <span>{item.name}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          <div className="flex-1 w-full">
            <AnimatePresence mode="wait">
              {activeTab === "homeDock" && <HomeDockSection key="homeDock" formData={formData} handleUpdate={handleUpdate} pushToQueue={pushToQueue} />}
              {activeTab === "profile" && <ProfileSection key="profile" formData={formData} handleUpdate={handleUpdate} pushToQueue={pushToQueue} />}
              {activeTab === "display" && <DisplaySection key="display" formData={formData} handleUpdate={handleUpdate} pushToQueue={pushToQueue} showToast={showToast} />}
              {activeTab === "background" && <BackgroundSection key="background" formData={formData} handleUpdate={handleUpdate} pushToQueue={pushToQueue} />}
              {activeTab === "music" && (
                <MusicSection
                  key="music"
                  formData={formData}
                  handleUpdate={handleUpdate}
                  pushToQueue={pushToQueue}
                  musicDetails={musicDetails}
                  setMusicDetails={setMusicDetails}
                  queryMusic={queryMusic}
                  queryLoading={queryLoading}
                  queryResult={queryResult}
                  confirmAddMusic={confirmAddMusic}
                  removeSong={removeSong}
                  showToast={showToast}
                />
              )}
              {activeTab === "gallery" && <GallerySection key="gallery" formData={formData} handleUpdate={handleUpdate} pushToQueue={pushToQueue} />}
              {activeTab === "footer" && <FooterSection key="footer" formData={formData} handleUpdate={handleUpdate} pushToQueue={pushToQueue} />}
              {activeTab === "danmaku" && <DanmakuSection key="danmaku" formData={formData} handleUpdate={handleUpdate} pushToQueue={pushToQueue} />}
              {activeTab === "comment" && <CommentSection key="comment" formData={formData} handleUpdate={handleUpdate} pushToQueue={pushToQueue} />}
              {activeTab === "aicat" && <AICatSection key="aicat" formData={formData} handleUpdate={handleUpdate} pushToQueue={pushToQueue} />}
              {activeTab === "repo" && <RepoSection key="repo" />}
            </AnimatePresence>
          </div>
        </main>
      </PageTransition>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ToastProvider>
      <SettingsContent />
    </ToastProvider>
  );
}
