"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CheckCircle2,
  CircleDashed,
  ImagePlus,
  Images,
  LayoutDashboard,
  MessageCircle,
  MonitorCog,
  Music2,
  Palette,
  PanelBottom,
  Rocket,
  User,
} from "lucide-react";
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

type SettingsItem = {
  id: string;
  name: string;
  group: "基础" | "视觉" | "内容" | "集成" | "发布";
  summary: string;
  Icon: LucideIcon;
};

const SETTINGS_MENU_ITEMS: SettingsItem[] = [
  { id: "profile", name: "站点资料", group: "基础", summary: "标题、头像、导航与友链申请", Icon: User },
  { id: "homeDock", name: "首页 Dock", group: "基础", summary: "首页模块入口与默认焦点", Icon: LayoutDashboard },
  { id: "display", name: "性能与动效", group: "视觉", summary: "动效开关、窗口尺寸与性能模式", Icon: MonitorCog },
  { id: "background", name: "背景图库", group: "视觉", summary: "背景上传、排序与保存", Icon: ImagePlus },
  { id: "music", name: "音乐配置", group: "内容", summary: "歌单来源、歌曲查询与播放模式", Icon: Music2 },
  { id: "gallery", name: "图集内容", group: "内容", summary: "相册、照片墙与本地资源", Icon: Images },
  { id: "footer", name: "页脚信息", group: "内容", summary: "页脚徽章、备案与底部展示", Icon: PanelBottom },
  { id: "danmaku", name: "弹幕文案", group: "集成", summary: "背景弹幕列表", Icon: MessageCircle },
  { id: "comment", name: "评论系统", group: "集成", summary: "Gitalk 仓库与权限配置", Icon: MessageCircle },
  { id: "aicat", name: "AI 接口", group: "集成", summary: "模型、密钥与系统提示词", Icon: Bot },
  { id: "repo", name: "部署发布", group: "发布", summary: "本地镜像、GitHub、Vercel 与 VPS", Icon: Rocket },
];

const SETTINGS_GROUPS = ["基础", "视觉", "内容", "集成", "发布"] as const;

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
  const { addOperation, operations } = useOperations();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [formData, setFormData] = useState<any>(createInitialFormData);
  const [configStatus, setConfigStatus] = useState<"loading" | "online" | "offline">("loading");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [musicDetails, setMusicDetails] = useState<Record<string, any>>({});
  const requestedMusicIdsRef = useRef<Set<string>>(new Set());
  const activeItem = useMemo(
    () => SETTINGS_MENU_ITEMS.find((item) => item.id === activeTab) || SETTINGS_MENU_ITEMS[0],
    [activeTab],
  );

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
        setConfigStatus("offline");
        showToast("Local Python backend is not connected. Start manager first.", "warning");
        return;
      }

      configLoadedRef.current = true;
      setConfigStatus("online");
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

  const ActiveIcon = activeItem.Icon;
  const statusMeta = configStatus === "online"
    ? { label: "后端已连接", Icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" }
    : configStatus === "offline"
      ? { label: "后端未连接", Icon: CircleDashed, className: "bg-amber-500/10 text-amber-600 dark:text-amber-300" }
      : { label: "读取配置中", Icon: CircleDashed, className: "bg-slate-500/10 text-slate-500 dark:text-slate-300" };
  const StatusIcon = statusMeta.Icon;

  return (
    <div className="relative min-h-screen pb-10">
      <Navbar />
      <PageTransition>
        <main className="relative z-10 mx-auto w-[95%] max-w-7xl pt-24">
          <section className="mb-5 rounded-3xl border border-white/50 bg-white/45 p-5 shadow-xl backdrop-blur-2xl dark:border-slate-800/60 dark:bg-slate-900/45">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25">
                  <Palette className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Settings Center</p>
                  <h1 className="mt-1 truncate text-2xl font-black text-slate-900 dark:text-white">设置中心</h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${statusMeta.className}`}>
                  <StatusIcon className="h-4 w-4" />
                  {statusMeta.label}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-2 text-xs font-black text-indigo-600 dark:text-indigo-300">
                  待处理 {operations.length}
                </span>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[286px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-24">
              <nav className="rounded-3xl border border-white/50 bg-white/45 p-3 shadow-xl backdrop-blur-2xl dark:border-slate-800/60 dark:bg-slate-900/45">
                {SETTINGS_GROUPS.map((group) => (
                  <section key={group} className="mb-3 last:mb-0">
                    <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{group}</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {SETTINGS_MENU_ITEMS.filter((item) => item.group === group).map((item) => {
                        const Icon = item.Icon;
                        const active = activeTab === item.id;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveTab(item.id)}
                            className={`flex min-h-[58px] items-center gap-3 rounded-2xl px-3 py-2 text-left transition-all ${
                              active
                                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                                : "text-slate-700 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800/70"
                            }`}
                          >
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black">{item.name}</span>
                              <span className={`mt-0.5 block truncate text-[11px] font-bold ${active ? "text-white/75" : "text-slate-400"}`}>
                                {item.summary}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </nav>
            </aside>

            <div className="min-w-0">
              <div className="mb-4 flex items-center gap-3 rounded-3xl border border-white/50 bg-white/40 p-4 shadow-lg backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/40">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950">
                  <ActiveIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{activeItem.group}</p>
                  <h2 className="truncate text-xl font-black text-slate-900 dark:text-white">{activeItem.name}</h2>
                </div>
              </div>

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
