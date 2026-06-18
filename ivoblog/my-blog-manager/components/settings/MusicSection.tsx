"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { fetchBackend, fetchBackendJson } from "./backendClient";

type PlaylistItem = {
  id: string;
  name: string;
  cover?: string;
  trackCount?: number;
  creator?: string;
};

type LoginStatus = {
  loggedIn: boolean;
  cookieSaved?: boolean;
  maskedCookie?: string;
  message?: string;
  profile?: {
    userId?: string;
    nickname?: string;
    avatarUrl?: string;
  };
  verificationFailed?: boolean;
};

function normalizeIds(value: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map(String)
        .filter((id) => /^\d{3,}$/.test(id)),
    ),
  ).slice(0, 50);
}

export default function MusicSection({
  formData,
  handleUpdate,
  pushToQueue,
  musicDetails,
  setMusicDetails,
  queryMusic,
  queryLoading,
  queryResult,
  confirmAddMusic,
  removeSong,
  showToast,
}: any) {
  const cloudMusicIds = normalizeIds(formData.cloudMusicIds);
  const playbackMode = formData.musicPlaybackMode === "local" ? "local" : "cloud";
  const detailMap = musicDetails || {};

  const [playlistId, setPlaylistId] = useState("");
  const [userId, setUserId] = useState("");
  const [neteaseCookie, setNeteaseCookie] = useState("");
  const [syncingPlaylist, setSyncingPlaylist] = useState(false);
  const [loadingUserPlaylists, setLoadingUserPlaylists] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<PlaylistItem[]>([]);
  const [loginStatus, setLoginStatus] = useState<LoginStatus>({
    loggedIn: false,
    message: "Checking login status...",
  });
  const [qrKey, setQrKey] = useState("");
  const [qrImg, setQrImg] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [qrMessage, setQrMessage] = useState("QR login may be limited by NetEase. Cookie login is more stable.");
  const [creatingQr, setCreatingQr] = useState(false);
  const [savingCookie, setSavingCookie] = useState(false);
  const [refreshingLogin, setRefreshingLogin] = useState(false);
  const [localAudioId, setLocalAudioId] = useState("");
  const [localAudioFiles, setLocalAudioFiles] = useState<File[]>([]);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [cachingPlaylist, setCachingPlaylist] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<any>(null);
  const pollingRef = useRef(false);
  const localAudioInputRef = useRef<HTMLInputElement>(null);
  const cacheTotal = Number(cacheStatus?.total || cloudMusicIds.length || 0);
  const cacheExisting = Number(cacheStatus?.existing || cacheStatus?.existingBefore || 0);
  const cacheCachedThisRun = Number(cacheStatus?.cached || 0);
  const cacheFailed = Number(cacheStatus?.failed || 0);
  const cachePartial = Number(cacheStatus?.partial || 0);
  const cacheDone = Math.min(cacheTotal, cacheExisting + cacheCachedThisRun);
  const cachePercent = cacheTotal > 0 ? Math.round((cacheDone / cacheTotal) * 100) : 0;

  const updateLoginStatus = useCallback((data: any) => {
    setLoginStatus({
      loggedIn: Boolean(data?.loggedIn),
      cookieSaved: Boolean(data?.cookieSaved || data?.maskedCookie),
      maskedCookie: data?.maskedCookie,
      profile: data?.profile,
      verificationFailed: Boolean(data?.verificationFailed),
      message: data?.message || (data?.loggedIn ? "NetEase account is logged in." : "NetEase account is not logged in."),
    });
  }, []);

  const loadLoginStatus = useCallback(async () => {
    try {
      const data = await fetchBackendJson("/api/music/login/status", undefined, 8000);
      if (!data?.success) {
        setLoginStatus({ loggedIn: false, message: data?.message || "Cannot read login status." });
        return;
      }
      updateLoginStatus(data);
    } catch {
      setLoginStatus({ loggedIn: false, message: "Local Python backend is not connected." });
    }
  }, [updateLoginStatus]);

  useEffect(() => {
    void loadLoginStatus();
  }, [loadLoginStatus]);

  useEffect(() => {
    if (!qrKey || pollingRef.current) return;

    let stopped = false;
    pollingRef.current = true;
    const startedAt = Date.now();

    const poll = async () => {
      if (Date.now() - startedAt > 120000) {
        setQrKey("");
        setQrMessage("QR code timed out. Generate a new one or use Cookie login.");
        pollingRef.current = false;
        return;
      }

      const data = await fetchBackendJson(`/api/music/login/qr/check/${qrKey}`, undefined, 8000);
      if (stopped) return;

      if (!data?.success) {
        setQrMessage(data?.message || "QR login check failed. Cookie login is recommended.");
        if (data?.code === 803 || data?.code === 800) {
          setQrKey("");
          setQrImg("");
          setQrUrl("");
          pollingRef.current = false;
        }
        return;
      }

      setQrMessage(data.message || "Waiting for confirmation...");
      if (data.code === 803 && data.loggedIn) {
        setQrKey("");
        setQrImg("");
        setQrUrl("");
        pollingRef.current = false;
        updateLoginStatus({ ...data, cookieSaved: true });
        showToast?.("NetEase QR login saved.", "success");
      }
      if (data.code === 800) {
        setQrKey("");
        setQrImg("");
        setQrUrl("");
        pollingRef.current = false;
        showToast?.("QR code expired.", "warning");
      }
    };

    void poll();
    const timer = window.setInterval(poll, 1200);
    return () => {
      stopped = true;
      pollingRef.current = false;
      window.clearInterval(timer);
    };
  }, [qrKey, showToast, updateLoginStatus]);

  const mergeSongDetails = (songs: any[]) => {
    if (!Array.isArray(songs) || songs.length === 0) return;
    const nextDetails = songs.reduce((acc, song) => {
      if (!song?.id) return acc;
      acc[String(song.id)] = {
        id: String(song.id),
        name: song.name || song.title || `NetEase Song ${song.id}`,
        artist: song.artist || song.author || "",
        album: song.album || "",
        cover: song.cover || song.pic || "",
      };
      return acc;
    }, {} as Record<string, any>);
    setMusicDetails?.((prev: Record<string, any>) => ({ ...prev, ...nextDetails }));
  };

  const mergeSongIds = (songIds: string[]) => {
    const merged = normalizeIds([...cloudMusicIds, ...songIds]);
    handleUpdate("cloudMusicIds", merged);
    return merged.length - cloudMusicIds.length;
  };

  const createQrLogin = async () => {
    setCreatingQr(true);
    setQrKey("");
    setQrImg("");
    setQrUrl("");
    setQrMessage("Creating QR code...");
    try {
      const data = await fetchBackendJson("/api/music/login/qr/create", undefined, 12000);
      if (!data?.success || !data.key) throw new Error(data?.message || "QR creation failed.");
      setQrKey(data.key);
      setQrImg(data.qrImg || "");
      setQrUrl(data.qrUrl || "");
      setQrMessage(data.message || "Scan with NetEase Cloud Music app.");
      showToast?.("QR code created.", "success");
    } catch (error: any) {
      setQrMessage(error?.message || "QR creation failed.");
      showToast?.(error?.message || "QR creation failed.", "error");
    } finally {
      setCreatingQr(false);
    }
  };

  const clearLogin = async () => {
    const data = await fetchBackendJson("/api/music/login/clear", { method: "POST" }, 8000);
    if (data?.success) {
      setLoginStatus({ loggedIn: false, cookieSaved: false, message: "Login state cleared." });
      setQrKey("");
      setQrImg("");
      setQrUrl("");
      showToast?.("NetEase login cleared.", "success");
    } else {
      showToast?.(data?.message || "Clear login failed.", "error");
    }
  };

  const saveCookieLogin = async () => {
    const cookie = neteaseCookie.trim();
    if (!cookie) {
      showToast?.("Paste a music.163.com Cookie first.", "warning");
      return;
    }

    setSavingCookie(true);
    try {
      const data = await fetchBackendJson(
        "/api/music/login/cookie",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookie }),
        },
        10000,
      );
      if (!data?.success) {
        showToast?.(data?.message || "Cookie login failed.", "error");
        updateLoginStatus({ ...data, cookieSaved: false });
        return;
      }
      setNeteaseCookie("");
      setQrKey("");
      setQrImg("");
      setQrUrl("");
      updateLoginStatus({ ...data, cookieSaved: true });
      showToast?.("Cookie login saved.", "success");
    } finally {
      setSavingCookie(false);
    }
  };

  const refreshLogin = async () => {
    setRefreshingLogin(true);
    try {
      const data = await fetchBackendJson("/api/music/login/refresh", { method: "POST" }, 10000);
      if (!data?.success) {
        showToast?.(data?.message || "Refresh login failed.", "error");
        updateLoginStatus({ ...data, cookieSaved: Boolean(loginStatus.cookieSaved) });
        return;
      }
      updateLoginStatus({ ...data, cookieSaved: true });
      showToast?.("Login refreshed.", "success");
    } finally {
      setRefreshingLogin(false);
    }
  };

  const syncPlaylist = async (targetId = playlistId) => {
    const cleanId = String(targetId || "").trim();
    if (!/^\d+$/.test(cleanId)) {
      showToast?.("Enter a valid NetEase playlist ID.", "warning");
      return;
    }

    setSyncingPlaylist(true);
    try {
      const data = await fetchBackendJson(
        "/api/music/playlist/sync",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playlistId: cleanId, cookie: neteaseCookie.trim(), limit: 50 }),
        },
        15000,
      );
      if (!data?.success) {
        showToast?.(data?.message || "Playlist sync failed.", "error");
        return;
      }
      const addedCount = mergeSongIds(data.songIds || []);
      mergeSongDetails(data.songs || []);
      showToast?.(`Synced ${data.playlist?.name || "playlist"}, added ${addedCount} songs.`, "success");
    } finally {
      setSyncingPlaylist(false);
    }
  };

  const loadUserPlaylists = async () => {
    const cleanId = userId.trim();
    if (!/^\d+$/.test(cleanId)) {
      showToast?.("Enter a valid NetEase user ID.", "warning");
      return;
    }
    setLoadingUserPlaylists(true);
    try {
      const data = await fetchBackendJson(`/api/music/user/${cleanId}/playlists`, undefined, 12000);
      if (!data?.success) {
        showToast?.(data?.message || "Load public playlists failed.", "error");
        return;
      }
      setUserPlaylists(data.playlists || []);
      showToast?.(`Loaded ${data.playlists?.length || 0} playlists.`, "success");
    } finally {
      setLoadingUserPlaylists(false);
    }
  };

  const loadMyPlaylists = async () => {
    setLoadingUserPlaylists(true);
    try {
      const data = await fetchBackendJson("/api/music/me/playlists", undefined, 12000);
      if (!data?.success) {
        showToast?.(data?.message || "Load account playlists failed. Save Cookie login first.", "error");
        updateLoginStatus({ ...data, cookieSaved: Boolean(loginStatus.cookieSaved || loginStatus.maskedCookie) });
        return;
      }
      updateLoginStatus({ ...data, cookieSaved: true });
      setUserPlaylists(data.playlists || []);
      showToast?.(`Loaded ${data.profile?.nickname || "account"} playlists.`, "success");
    } finally {
      setLoadingUserPlaylists(false);
    }
  };

  const uploadLocalAudio = async () => {
    if (localAudioFiles.length === 0) {
      showToast?.("Choose one or more local audio files first.", "warning");
      return;
    }

    setUploadingAudio(true);
    try {
      const form = new FormData();
      form.append("id", localAudioFiles.length === 1 ? localAudioId.trim() : "");
      localAudioFiles.forEach((file) => form.append("files", file));
      const response = await fetchBackend("/api/music/local/upload/batch", {
        method: "POST",
        body: form,
      }, 180000);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        showToast?.(data?.message || "Upload local audio failed.", "error");
        return;
      }

      const uploadedItems = Array.isArray(data.items) ? data.items : [];
      const uploadedIds = uploadedItems.map((item: any) => String(item.id || "")).filter(Boolean);
      const detailUpdates = uploadedItems.reduce((acc: Record<string, any>, item: any) => {
        const songId = String(item.id || "");
        if (!songId) return acc;
        acc[songId] = {
          id: songId,
          name: item.title || item.name || `Local Song ${songId}`,
          artist: item.artist || "Unknown Artist",
          album: item.album || "",
          cover: item.cover || "",
        };
        return acc;
      }, {});

      setMusicDetails?.((prev: Record<string, any>) => ({
        ...prev,
        ...detailUpdates,
      }));

      // Clear playlist localStorage cache so the player picks up new covers immediately
      try { window.localStorage.removeItem("iv0:music-playlist:v3"); } catch { /* noop */ }

      const nextIds = normalizeIds([...cloudMusicIds, ...uploadedIds]);
      handleUpdate("cloudMusicIds", nextIds);
      handleUpdate("musicPlaybackMode", "local");
      pushToQueue("Music playlist", { cloudMusicIds: nextIds, musicPlaybackMode: "local" });

      setLocalAudioFiles([]);
      setLocalAudioId("");
      if (localAudioInputRef.current) localAudioInputRef.current.value = "";
      showToast?.(`Uploaded ${uploadedItems.length} local song${uploadedItems.length === 1 ? "" : "s"} and added to playlist.`, "success");
      void loadCacheStatus();
    } finally {
      setUploadingAudio(false);
    }
  };

  const loadCacheStatus = async () => {
    if (cloudMusicIds.length === 0) {
      setCacheStatus(null);
      return;
    }
    try {
      const data = await fetchBackendJson(
        `/api/music/local/cache/status?ids=${encodeURIComponent(cloudMusicIds.slice(0, 50).join(","))}`,
        undefined,
        12000,
      );
      if (data?.success) setCacheStatus((prev: any) => ({ ...(prev || {}), ...data, running: false }));
    } catch {
      // Status is only for visibility; playback does not depend on it.
    }
  };

  const cachePlaylistAudio = async () => {
    if (cloudMusicIds.length === 0) {
      showToast?.("No songs to cache.", "warning");
      return;
    }

    setCachingPlaylist(true);
    setCacheStatus((prev: any) => ({ ...(prev || {}), total: cloudMusicIds.length, running: true }));
    try {
      await loadCacheStatus();
      const data = await fetchBackendJson(
        "/api/music/local/cache",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: cloudMusicIds.slice(0, 50) }),
        },
        300000,
      );
      if (!data?.success) {
        showToast?.(data?.message || "Cache playlist failed.", "error");
        setCacheStatus((prev: any) => ({ ...(prev || {}), running: false, failed: data?.failed || prev?.failed || 0 }));
        return;
      }
      setCacheStatus((prev: any) => ({
        ...(prev || {}),
        running: false,
        cached: data.cached || 0,
        existingBefore: data.existing || 0,
        failed: data.failed || 0,
        targets: data.targets,
      }));
      await loadCacheStatus();
      showToast?.(`Cached ${data.cached || 0} songs, skipped ${data.failed || 0}.`, data.failed ? "warning" : "success");
    } finally {
      setCachingPlaylist(false);
    }
  };

  useEffect(() => {
    void loadCacheStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudMusicIds.join(",")]);

  const statusLabel = loginStatus.loggedIn ? "Logged in" : loginStatus.cookieSaved ? "Cookie saved" : "Not logged in";
  const statusClass = loginStatus.loggedIn
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
    : loginStatus.cookieSaved
      ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300"
      : "border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

  return (
    <motion.section
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.28 }}
      className="rounded-[40px] border border-white/50 bg-white/40 p-6 shadow-2xl backdrop-blur-2xl dark:border-slate-800/50 dark:bg-slate-900/40 md:p-8"
    >
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white">Music Playlist</h2>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            Changes are saved immediately. Playlist sync keeps the first 50 songs for smooth playback.
          </p>
        </div>
        <button
          type="button"
          onClick={() => pushToQueue("Music playlist", "cloudMusicIds", cloudMusicIds)}
          className="rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-500/25 transition-colors hover:bg-indigo-600"
        >
          Save Music Config
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current song IDs: {cloudMusicIds.length} / 50</p>
          <div className="custom-scrollbar max-h-[620px] space-y-2 overflow-y-auto pr-2">
            {cloudMusicIds.map((id: string, index: number) => {
              const detail = detailMap[id];
              return (
                <div key={`${id}-${index}`} className="group flex items-center justify-between rounded-2xl border border-white/30 bg-white/45 p-3 dark:border-slate-700/50 dark:bg-slate-800/45">
                  <div className="flex min-w-0 items-center gap-3">
                    {detail?.cover ? (
                      <img src={detail.cover} alt={detail.name || "cover"} className="h-11 w-11 rounded-xl object-cover shadow-sm" />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-xs font-black text-indigo-500">ID</div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-700 dark:text-slate-100">{detail?.name || `NetEase Song ${id}`}</p>
                      <p className="truncate text-xs font-medium text-slate-400">{detail?.artist || id}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSong(index)}
                    className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-500 opacity-80 transition hover:bg-rose-500 hover:text-white"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocalAudioId(id)}
                    className="ml-2 rounded-xl bg-indigo-500/10 px-3 py-2 text-xs font-black text-indigo-500 opacity-80 transition hover:bg-indigo-500 hover:text-white"
                  >
                    Local
                  </button>
                </div>
              );
            })}
            {cloudMusicIds.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400 dark:border-slate-700">
                No songs configured yet.
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white/55 p-5 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-2 text-sm font-black text-slate-700 dark:text-slate-100">播放源</p>
            <p className="mb-4 text-xs font-bold text-slate-400">
              有对应本地文件时始终优先播放文件；没有本地文件时按这里选择云端直连或本地缓存。
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-950/60">
              {[
                { value: "cloud", label: "云播放" },
                { value: "local", label: "本地播放" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleUpdate("musicPlaybackMode", item.value)}
                  className={`rounded-xl px-3 py-3 text-xs font-black transition ${
                    playbackMode === item.value
                      ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                      : "text-slate-500 hover:bg-white/70 dark:hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={cachePlaylistAudio}
              disabled={cachingPlaylist || uploadingAudio || cloudMusicIds.length === 0}
              className="mt-4 w-full rounded-2xl bg-emerald-500 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {cachingPlaylist ? `正在缓存 ${cachePercent}%` : "一键下载缓存当前歌单"}
            </button>
            <div className="mt-3 rounded-2xl border border-white/40 bg-white/45 px-4 py-3 text-xs font-bold text-slate-500 dark:border-slate-700/60 dark:bg-slate-950/30 dark:text-slate-300">
              {cacheStatus?.running ? (
                <span>
                  正在写入本地缓存：{cacheDone} / {cacheTotal} 首（{cachePercent}%）。请保持管理端后端运行。
                  {cachePartial > 0 ? ` 有 ${cachePartial} 首正在补齐 blog/manager 双端文件。` : ""}
                </span>
              ) : cacheStatus?.total ? (
                <span>
                  本地已缓存 {cacheDone} / {cacheTotal} 首（{cachePercent}%）
                  {cacheCachedThisRun > 0 ? `，本次新增 ${cacheCachedThisRun} 首` : ""}
                  {cachePartial > 0 ? `，待补齐 ${cachePartial} 首` : ""}
                  {cacheFailed > 0 ? `，失败 ${cacheFailed} 首` : ""}
                </span>
              ) : (
                <span>缓存状态会显示真实本地文件数量。</span>
              )}
            </div>
          </section>

          <section className={`rounded-3xl border p-5 ${statusClass}`}>
            <p className="text-xs font-black uppercase tracking-widest">NetEase Login</p>
            <p className="mt-2 text-lg font-black">{statusLabel}</p>
            <p className="mt-1 text-xs font-bold opacity-80">{loginStatus.message}</p>
            {loginStatus.profile?.avatarUrl && (
              <img src={loginStatus.profile.avatarUrl} alt={loginStatus.profile.nickname || "NetEase avatar"} className="mt-4 h-12 w-12 rounded-2xl object-cover" />
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button type="button" onClick={createQrLogin} disabled={creatingQr} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50 dark:bg-slate-900/50 dark:text-slate-200">
                {creatingQr ? "Creating" : "QR"}
              </button>
              <button type="button" onClick={refreshLogin} disabled={refreshingLogin} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-black text-slate-700 disabled:opacity-50 dark:bg-slate-900/50 dark:text-slate-200">
                Refresh
              </button>
              <button type="button" onClick={clearLogin} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-black text-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
                Clear
              </button>
            </div>
            {(qrImg || qrUrl) && (
              <div className="mt-4 rounded-2xl bg-white/80 p-4 text-center dark:bg-slate-950/50">
                {qrImg ? <img src={qrImg} alt="NetEase QR" className="mx-auto h-40 w-40 rounded-xl bg-white object-contain p-2" /> : <p className="break-all text-xs">{qrUrl}</p>}
                <p className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-400">{qrMessage}</p>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/55 p-5 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-3 text-sm font-black text-slate-700 dark:text-slate-100">Cookie Login</p>
            <textarea
              value={neteaseCookie}
              onChange={(event) => setNeteaseCookie(event.target.value)}
              placeholder="Paste music.163.com Cookie here."
              className="h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white/80 p-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <button type="button" onClick={saveCookieLogin} disabled={savingCookie} className="mt-3 w-full rounded-2xl bg-slate-900 py-3 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">
              {savingCookie ? "Saving..." : "Save Cookie Login"}
            </button>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/55 p-5 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-3 text-sm font-black text-slate-700 dark:text-slate-100">Upload Local Music</p>
            <p className="mb-3 text-xs font-bold text-slate-400">
              直接选择本地音乐文件，系统会自动识别歌曲名、歌手和封面（MP3 内嵌 ID3 标签）。无需手动填 ID。
            </p>
            <input
              ref={localAudioInputRef}
              type="file"
              multiple
              accept="audio/mpeg,audio/mp3,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/flac,.mp3,.m4a,.aac,.ogg,.wav,.flac,.lrc"
              onChange={(event) => setLocalAudioFiles(Array.from(event.target.files || []))}
              className="w-full rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-3 text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <button type="button" onClick={uploadLocalAudio} disabled={uploadingAudio || cachingPlaylist || localAudioFiles.length === 0} className="mt-3 w-full rounded-2xl bg-pink-500 py-3 text-sm font-black text-white disabled:opacity-50">
              {uploadingAudio ? "Reading metadata & uploading..." : localAudioFiles.length > 0 ? `Upload ${localAudioFiles.length} file${localAudioFiles.length === 1 ? "" : "s"}` : "Choose files first"}
            </button>
            <p className="mt-3 text-xs font-bold text-slate-400">
              支持批量上传音频，可同时选择同名 .lrc 歌词；FLAC 会保留原文件不自动转 MP3，播放器会优先读取本地文件。
            </p>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/55 p-5 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-3 text-sm font-black text-slate-700 dark:text-slate-100">Add Song</p>
            <div className="flex gap-2">
              <input
                value={formData.newMusicId || ""}
                onChange={(event) => handleUpdate("newMusicId", event.target.value)}
                placeholder="Song ID"
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900"
              />
              <button type="button" onClick={queryMusic} disabled={queryLoading} className="rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                {queryLoading ? "..." : "Query"}
              </button>
            </div>
            {queryResult && (
              <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-500/10 p-3">
                <p className="text-sm font-black text-slate-700 dark:text-slate-100">{queryResult.name || queryResult.title}</p>
                <p className="text-xs text-slate-500">{queryResult.artist || queryResult.author || queryResult.id}</p>
                <button type="button" onClick={confirmAddMusic} className="mt-3 w-full rounded-xl bg-indigo-500 py-2 text-xs font-black text-white">
                  Add To Playlist
                </button>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/55 p-5 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-3 text-sm font-black text-slate-700 dark:text-slate-100">Playlist Sync</p>
            <input
              value={playlistId}
              onChange={(event) => setPlaylistId(event.target.value)}
              placeholder="Playlist ID"
              className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <button type="button" onClick={() => syncPlaylist()} disabled={syncingPlaylist} className="mt-3 w-full rounded-2xl bg-emerald-500 py-3 text-sm font-black text-white disabled:opacity-50">
              {syncingPlaylist ? "Syncing..." : "Sync First 50 Songs"}
            </button>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/55 p-5 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="mb-3 flex gap-2">
              <button type="button" onClick={loadMyPlaylists} disabled={loadingUserPlaylists} className="flex-1 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50">
                My Playlists
              </button>
              <button type="button" onClick={loadUserPlaylists} disabled={loadingUserPlaylists} className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">
                Public User
              </button>
            </div>
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="User ID for public playlists"
              className="mb-3 w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {userPlaylists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => syncPlaylist(playlist.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white/70 p-3 text-left transition hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-900/60"
                >
                  {playlist.cover ? <img src={playlist.cover} alt={playlist.name} className="h-10 w-10 rounded-xl object-cover" /> : <div className="h-10 w-10 rounded-xl bg-indigo-500/10" />}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-slate-700 dark:text-slate-200">{playlist.name}</span>
                    <span className="text-xs text-slate-400">#{playlist.id} / {playlist.trackCount || 0} songs</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </motion.section>
  );
}
